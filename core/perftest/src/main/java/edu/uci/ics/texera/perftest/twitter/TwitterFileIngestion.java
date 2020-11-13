package edu.uci.ics.texera.perftest.twitter;

import java.io.*;
import java.util.ArrayList;
import java.util.function.Function;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import edu.uci.ics.texera.api.constants.SchemaConstants;
import edu.uci.ics.texera.api.dataflow.ISourceOperator;
import edu.uci.ics.texera.api.exception.TexeraException;
import edu.uci.ics.texera.api.field.IDField;
import edu.uci.ics.texera.api.field.StringField;
import edu.uci.ics.texera.api.field.TextField;
import edu.uci.ics.texera.api.schema.Attribute;
import edu.uci.ics.texera.api.schema.AttributeType;
import edu.uci.ics.texera.api.schema.Schema;
import edu.uci.ics.texera.api.tuple.Tuple;
import edu.uci.ics.texera.api.utils.Utils;
import edu.uci.ics.texera.dataflow.sink.tuple.TupleSink;
import edu.uci.ics.texera.dataflow.sink.tuple.TupleSinkPredicate;
import edu.uci.ics.texera.dataflow.source.tuple.TupleSourceOperator;
import edu.uci.ics.texera.dataflow.twitter.TwitterJsonConverter;
import edu.uci.ics.texera.dataflow.twitter.TwitterJsonConverterPredicate;
import edu.uci.ics.texera.perftest.utils.PerfTestUtils;
import edu.uci.ics.texera.storage.DataWriter;
import edu.uci.ics.texera.storage.RelationManager;
import edu.uci.ics.texera.storage.constants.LuceneAnalyzerConstants;

/**
 * Creates an twitter_sample table and ingests a small sample set of twitter data into the table.
 *
 * @author Zuozhi Wang
 */
public class TwitterFileIngestion {

    //    public static String twitterFilePath = PerfTestUtils.getResourcePath("/sample-data-files/twitter/tweets.json").toString();
    public static String twitterFilePath = "testtest_geotag.json";

    public static String twitterClimateTable = "twitter_puerto";

    public static void main(String[] args) throws Exception {
        writeTwitterIndex();
    }

    public static class TempSourceOperator implements ISourceOperator {

        String fieldName;
        String file;
        Function<String, String> processLine;
        Schema schema;
        BufferedReader reader;

        public TempSourceOperator(String fieldName, String file, Function<String, String> processLine) {
            this.fieldName = fieldName;
            this.file = file;
            this.processLine = processLine;
            this.schema = new Schema(
                    SchemaConstants._ID_ATTRIBUTE,
                    new Attribute(fieldName, AttributeType.TEXT));
        }


        @Override
        public void open() throws TexeraException {
            try {
                this.reader = new BufferedReader(new FileReader((file)));
            } catch (FileNotFoundException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        public Tuple getNextTuple() throws TexeraException {
            try {
                String line = this.reader.readLine();
                if (line == null) {
                    return null;
                }
                return new Tuple(this.schema, IDField.newRandomID(), new TextField((this.processLine.apply(line))));
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        public void close() throws TexeraException {
            if (this.reader != null) {
                try {
                    this.reader.close();
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
        }

        @Override
        public Schema getOutputSchema() {
            return schema;
        }

        @Override
        public Schema transformToOutputSchema(Schema... inputSchema) {
            return schema;
        }
    }


    /**
     * Writes the sample twitter data into the twitter_sample table
     * @throws Exception
     */
    public static void writeTwitterIndex() throws Exception {

        // read the JSON file into a list of JSON string tuples
//        JsonNode jsonNode = new ObjectMapper().readTree(new File(twitterFilePath));

        ISourceOperator sourceOperator = new TempSourceOperator("twitterJson", twitterFilePath,
                line -> line.substring(2));

        // setup the twitter converter DAG
        // TupleSource --> TwitterJsonConverter --> TupleSink


        createTwitterTable(twitterClimateTable, sourceOperator);
    }


    /**
     * A helper function to create a table and write twitter data into it.
     *
     * @param tableName
     * @param twitterJsonSourceOperator, a source operator that provides the input raw twitter JSON string tuples
     * @return
     */
    public static int createTwitterTable(String tableName, ISourceOperator twitterJsonSourceOperator) {

        TwitterJsonConverter twitterJsonConverter = new TwitterJsonConverterPredicate("twitterJson").newOperator();

        TupleSink tupleSink = new TupleSinkPredicate(null, null).newOperator();

        twitterJsonConverter.setInputOperator(twitterJsonSourceOperator);
        tupleSink.setInputOperator(twitterJsonConverter);

        // open the workflow plan and get the output schema
        tupleSink.open();

        // create the table with TupleSink's output schema
        RelationManager relationManager = RelationManager.getInstance();

        if (relationManager.checkTableExistence(tableName)) {
            relationManager.deleteTable(tableName);
        }
        relationManager.createTable(tableName, Utils.getDefaultIndexDirectory().resolve(tableName),
                tupleSink.getOutputSchema(), LuceneAnalyzerConstants.standardAnalyzerString());
        DataWriter dataWriter = relationManager.getTableDataWriter(tableName);
        dataWriter.open();

        Tuple tuple;
        int counter = 0;
        while ((tuple = tupleSink.getNextTuple()) != null) {
            Tuple tupleWithoutID = new Tuple.Builder(tuple).removeIfExists("_id").build();
            dataWriter.insertTuple(tupleWithoutID);
            counter++;
        }

        dataWriter.close();
        tupleSink.close();

        return counter;
    }

}
