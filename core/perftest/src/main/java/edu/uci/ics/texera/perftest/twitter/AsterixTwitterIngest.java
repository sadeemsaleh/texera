
package edu.uci.ics.texera.perftest.twitter;

import edu.uci.ics.texera.dataflow.source.asterix.AsterixSource;
import edu.uci.ics.texera.dataflow.source.asterix.AsterixSourcePredicate;

/**
 * A helper class to query data from the main Asterix database with more than 1 billion of tweets based on a set of keywords,
 *  and then writes the data to a table.
 * 
 * @author Zuozhi Wang
 */
public class AsterixTwitterIngest {
    
    public static void main(String[] args) {
        ingestKeywords("01a_hurricane_maria",
                "hurricane huracan government gobierno disaster desastre FEMA Puerto Rico resilience resiliencia",
                "2017-09-01", "2018-02-01", null);
        ingestKeywords("01b_hurricane_maria_water",
                "agua PRASA desastre water Puerto Rico comunidad AAA",
                "2017-09-01", "2020-04-01", null);
    }

    public static void ingestKeywords(String tableName, String keywords, String startDate, String endDate, Integer limit) {
        
        AsterixSourcePredicate asterixSourcePredicate = new AsterixSourcePredicate(
                "twitterJson",
                "americium.ics.uci.edu",
                19002,
                "twitter",
                "ds_tweet",
                "text",
                keywords,
                startDate,
                endDate,
                limit);

        AsterixSource asterixSource = asterixSourcePredicate.newOperator();

        TwitterSample.createTwitterTable(tableName, asterixSource);
    }

}
