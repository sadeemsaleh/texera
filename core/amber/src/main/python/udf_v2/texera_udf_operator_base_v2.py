import pandas
from typing import Generator


class InputExhausted:
	pass


class TexeraUDFOperatorV2(object):
	"""
	Base class for row-oriented one-table input, one-table output user-defined operators. This must be implemented
	before using.
	"""
	def __init__(self):
		self._args = None

	def open(self, args: str):
		"""
		Specify here what the UDF should do before executing on tuples. For example, you may want to open a model file
		before using the model for prediction.

			:param args: a string of user-provided arguments that might be used.
				This is specified in Texera's UDFOperator configuration panel.
		"""
		self._args = args

	def process_tuple(self, row: pandas.Series | InputExhausted, nth_child: int) -> Generator[pandas.Series | None]:
		"""
		This is what the UDF operator should do for every row. Do not return anything here, just accept it. The result
		should be retrieved with next().
		Returns a generator

			:param row: The input row to accept and do custom execution,
						or an InputExhausted signal, indicating there will be no more input rows from this child.
			:param nth_child: The child the current data is coming from.
		"""
		raise NotImplementedError

	def close(self):
		"""
		Close this operator, releasing any resources. For example, you might want to close a model file.
		"""
		raise NotImplementedError


class TexeraMapOperatorV2(TexeraUDFOperatorV2):
	"""
	Base class for one-input-tuple to one-output-tuple mapping operator. Either inherit this class (in case you want to
	override open() and close(), e.g., open and close a model file.) or init this class object with a map function.
	The map function should return the result tuple. If use inherit, then script should have an attribute named
	`operator_instance` that is an instance of the inherited class; If only use filter function, simply define a
	`map_function` in the script.
	"""

	def __init__(self, map_function=None):
		super().__init__()
		self._map_function = map_function

	def process_tuple(self, row: pandas.Series | InputExhausted, nth_child: int):
		if self._map_function is None:
			raise NotImplementedError
		if isinstance(row, InputExhausted):
			yield from []
		else:
			yield self._map_function(row, self._args)

	def close(self):
		pass


class TexeraFilterOperatorV2(TexeraUDFOperatorV2):
	"""
		Base class for filter operators. Either inherit this class (in case you want to
		override open() and close(), e.g., open and close a model file.) or init this class object with a filter function.
		The filter function should return a boolean value indicating whether the input tuple meets the filter criteria.
		If use inherit, then script should have an attribute named `operator_instance` that is an instance of the
		inherited class; If only use filter function, simply define a `filter_function` in the script.
		"""

	def __init__(self, filter_function=None):
		super().__init__()
		self._filter_function = filter_function

	def process_tuple(self, row: pandas.Series | InputExhausted, nth_child: int):
		if self._filter_function is None:
			raise NotImplementedError
		if isinstance(row, InputExhausted):
			yield from []
		elif self._filter_function(row, self._args):
			yield row
		else:
			yield from []

	def close(self):
		pass
