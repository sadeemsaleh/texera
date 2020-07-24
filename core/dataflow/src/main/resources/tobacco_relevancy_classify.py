import sys
import pickle
import pyarrow
import pandas
import ast
import threading
import pyarrow.flight
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

count_vectorizer_model_path = sys.argv[1]
tobacco_classifier_model_path = sys.argv[2]


def lower_case(text):
	# make all words lower case
	text = text.lower()
	return text


def remove_stopwords(text):
	# remove natural language stop words in the text
	words = [w for w in text if w not in stopwords.words('english')]
	return words


def combine_text(list_of_word):
	return ' '.join(list_of_word)


def text_preprocessing(data):
	# apply all the NLP preprocessing
	# print('preprocessing data...')
	data['text'] = data['text'].apply(lambda x: lower_case(x))
	# print('finish lower case...')
	data['text'] = data['text'].apply(lambda x: word_tokenize(x))
	# print('finish tokenize...')
	data['text'] = data['text'].apply(lambda x: remove_stopwords(x))
	# print('finish remove stop words...')
	data['text'] = data['text'].apply(lambda x: combine_text(x))
	# print('finish combine text...')

	return data


class TobaccoClassifier(object):

	def __init__(self, cv_dir='tobacco_cv.sav', model_dir='tobacco_model.sav'):
		# model used to do classfication
		self.count_vectorizer = pickle.load(open(cv_dir, 'rb'))
		self.model = pickle.load(open(model_dir, 'rb'))

	def predict(self, test_data):
		test_data = text_preprocessing(test_data)
		test_vector = self.count_vectorizer.transform(test_data['text'])
		return self.model.predict(test_vector)


classifier_model = TobaccoClassifier(cv_dir=count_vectorizer_model_path, model_dir=tobacco_classifier_model_path)


class FlightServer(pyarrow.flight.FlightServerBase):
	def __init__(self, host="localhost", location=None, tls_certificates=None, auth_handler=None):
		super(FlightServer, self).__init__(
			location, auth_handler, tls_certificates)
		self.flights = {}
		self.host = host
		self.tls_certificates = tls_certificates

	@classmethod
	def descriptor_to_key(self, descriptor):
		return (descriptor.descriptor_type.value, descriptor.command,
				tuple(descriptor.path or tuple()))

	def _make_flight_info(self, key, descriptor, table):
		if self.tls_certificates:
			location = pyarrow.flight.Location.for_grpc_tls(
				self.host, self.port)
		else:
			location = pyarrow.flight.Location.for_grpc_tcp(
				self.host, self.port)
		endpoints = [pyarrow.flight.FlightEndpoint(repr(key), [location]), ]

		mock_sink = pyarrow.MockOutputStream()
		stream_writer = pyarrow.RecordBatchStreamWriter(
			mock_sink, table.schema)
		stream_writer.write_table(table)
		stream_writer.close()
		data_size = mock_sink.size()

		return pyarrow.flight.FlightInfo(table.schema,
										 descriptor, endpoints,
										 table.num_rows, data_size)

	def list_flights(self, context, criteria):
		for key, table in self.flights.items():
			if key[1] is not None:
				descriptor = \
					pyarrow.flight.FlightDescriptor.for_command(key[1])
			else:
				descriptor = pyarrow.flight.FlightDescriptor.for_path(*key[2])

			yield self._make_flight_info(key, descriptor, table)

	def get_flight_info(self, context, descriptor):
		key = FlightServer.descriptor_to_key(descriptor)
		if key in self.flights:
			table = self.flights[key]
			return self._make_flight_info(key, descriptor, table)
		raise KeyError('Flight not found.')

	def do_put(self, context, descriptor, reader, writer):
		key = FlightServer.descriptor_to_key(descriptor)
		self.flights[key] = reader.read_all()

	def do_get(self, context, ticket):
		key = ast.literal_eval(ticket.ticket.decode())
		if key not in self.flights:
			print("Flight Server:\tNOT IN")
			return None
		return pyarrow.flight.RecordBatchStream(self.flights[key])

	def do_action(self, context, action):
		if action.type == "compute":
			input_descriptor = pyarrow.flight.FlightDescriptor.for_path(b'ToPython')
			# print("Flight Server:\tComputing relevancy...")
			key = FlightServer.descriptor_to_key(input_descriptor)
			# print("Flight Server:\t\tConverting Arrow data to pandas.Dataframe...", end=" ")
			input_dataframe = pandas.DataFrame(self.flights[key].to_pandas())
			# print("Done.")
			# print("Flight Server:\t\tExecuting computation...", end=" ")
			predictions = classifier_model.predict(input_dataframe)
			outout_data = {'pred': predictions}
			output_dataframe = pandas.DataFrame(data=outout_data)
			# print("Done.")
			# print("Flight Server:\t\tConverting back to Arrow data...", end =" ")
			output_descriptor = pyarrow.flight.FlightDescriptor.for_path(b'FromPython')
			self.flights[FlightServer.descriptor_to_key(output_descriptor)] = pyarrow.Table.from_pandas(output_dataframe)
			# print("Done.")
			# print("Flight Server:\tDone.")
			self.flights.pop(key)
			yield pyarrow.flight.Result(pyarrow.py_buffer(b'Success!'))
		elif action.type == "healthcheck":
			yield pyarrow.flight.Result(pyarrow.py_buffer(b'Flight Server is up and running!'))
		elif action.type == "shutdown":
			yield pyarrow.flight.Result(pyarrow.py_buffer(b'Flight Server is shut down!'))
			# Shut down on background thread to avoid blocking current
			# request
			threading.Thread(target=self._shutdown).start()
		else:
			raise KeyError("Unknown action {!r}".format(action.type))

	def _shutdown(self):
		"""Shut down after a delay."""
		print("Flight Server:\tServer is shutting down...")

		self.shutdown()
		self.wait()


def main():
	location = "grpc+tcp://localhost:5005"
	server = FlightServer("localhost", location)
	print("Flight Server:\tServing on", location)
	server.serve()


if __name__ == '__main__':
	main()
