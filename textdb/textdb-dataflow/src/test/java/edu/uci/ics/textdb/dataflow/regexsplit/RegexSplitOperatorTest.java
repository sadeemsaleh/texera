package edu.uci.ics.textdb.dataflow.regexsplit;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.junit.AfterClass;
import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;

import edu.uci.ics.textdb.api.constants.TestConstantsChinese;
import edu.uci.ics.textdb.api.constants.TestConstantsRegexSplit;
import edu.uci.ics.textdb.api.exception.DataFlowException;
import edu.uci.ics.textdb.api.exception.TextDBException;
import edu.uci.ics.textdb.api.tuple.Tuple;
import edu.uci.ics.textdb.dataflow.source.ScanBasedSourceOperator;
import edu.uci.ics.textdb.storage.DataWriter;
import edu.uci.ics.textdb.storage.RelationManager;
import edu.uci.ics.textdb.storage.constants.LuceneAnalyzerConstants;

/**
 * @author Zuozhi Wang
 * @author Qinhua Huang
 *
 */
public class RegexSplitOperatorTest {
    
    public static final String CHINESE_TABLE = "regex_split_test_chinese";
    public static final String REGEX_TABLE = "regex_split_test";
    
    @BeforeClass
    public static void setUp() throws TextDBException {
        RelationManager relationManager = RelationManager.getRelationManager();
        // create the people table and write tuples in Chinese
        relationManager.createTable(CHINESE_TABLE, "../index/test_tables/" + CHINESE_TABLE, 
                TestConstantsChinese.SCHEMA_PEOPLE, LuceneAnalyzerConstants.chineseAnalyzerString());
        DataWriter chineseDataWriter = relationManager.getTableDataWriter(CHINESE_TABLE);
        chineseDataWriter.open();
        for (Tuple tuple : TestConstantsChinese.getSamplePeopleTuples()) {
            chineseDataWriter.insertTuple(tuple);
        }
        chineseDataWriter.close();
        
        RelationManager.getRelationManager().deleteTable(REGEX_TABLE);
        RelationManager relationManager2 = RelationManager.getRelationManager();
        relationManager2.createTable(REGEX_TABLE, "../index/test_tables/" + REGEX_TABLE, 
                TestConstantsRegexSplit.SCHEMA_PEOPLE, LuceneAnalyzerConstants.standardAnalyzerString());
        DataWriter regexDataWriter = relationManager2.getTableDataWriter(REGEX_TABLE);
        regexDataWriter.open();
        for (Tuple tuple : TestConstantsRegexSplit.getSamplePeopleTuples()) {
            regexDataWriter.insertTuple(tuple);
        }
        regexDataWriter.close();
    }
    
    @AfterClass
    public static void cleanUp() throws TextDBException {
        RelationManager.getRelationManager().deleteTable(CHINESE_TABLE);
        RelationManager.getRelationManager().deleteTable(REGEX_TABLE);
    }
    
    public static List<Tuple> getRegexSplitResults(
            String tableName, String splitRegex, String splitAttrName, RegexSplitPredicate.
            SplitType splitType ) throws TextDBException{
        ScanBasedSourceOperator scanSource = new ScanBasedSourceOperator(tableName);
        RegexSplitOperator regexSplit = new RegexSplitOperator(
                new RegexSplitPredicate(splitRegex, splitAttrName, splitType));
        regexSplit.setInputOperator(scanSource);
        
        List<Tuple> results = new ArrayList<>();
        Tuple tuple;
        
        regexSplit.open();
        while((tuple = regexSplit.getNextTuple()) != null) {
            results.add(tuple);
        }
        regexSplit.close();
        return results;
    }
    
    /*
     *  To divide the non (TextField | StringField) field. 
     *  This will fail.
     */
    @Test(expected = DataFlowException.class)
    public void test1() throws TextDBException {
        String splitRegex = "19";
        String splitAttrName = TestConstantsChinese.DATE_OF_BIRTH;
        boolean catchException = false;
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.GROUP_RIGHT);
    }
    
    /*
     * Overlaped patterns in STANDALONE model:
     * When a string contains multiple patterns overlap in position, it will only return the largest one as tuple.
     */
    @Test
    public void test2() throws TextDBException {
        String splitRegex = "A.*B.*C.*D";
        String splitAttrName = TestConstantsRegexSplit.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("ABCDEABCDFABCD");
        splitResult.add("GA");
        splitResult.add("ABACBDCD");
        
        List<Tuple> results = getRegexSplitResults(REGEX_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.STANDALONE);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsRegexSplit.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());
        Assert.assertEquals(splitResult, splitStrings);
    }
    
    /*
     * Overlaped patterns in STANDALONE model:
     */
    @Test
    public void test3() throws TextDBException {
        String splitRegex = "A.{1,5}A";
        String splitAttrName = TestConstantsRegexSplit.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("ABCDEA");
        splitResult.add("BCDF");
        splitResult.add("ABCDGA");
        splitResult.add("ABA");
        splitResult.add("CBDCD");
        
        List<Tuple> results = getRegexSplitResults(REGEX_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.STANDALONE);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsRegexSplit.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());
        Assert.assertEquals(splitResult, splitStrings);
    }
    
    /*
     *  Divide the String field.
     */
    @Test
    public void test4() throws TextDBException {
        String splitRegex = "克";
        String splitAttrName = TestConstantsChinese.LAST_NAME;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("长孙");
        splitResult.add("洛");
        splitResult.add("克");
        splitResult.add("贝尔");
        splitResult.add("建筑");
        
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.STANDALONE);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsChinese.LAST_NAME).getValue().toString())
                .collect(Collectors.toList());

        Assert.assertEquals(splitResult, splitStrings);
    }
    
    /*
     *  Group the pattern string to right group for dividing TextField.
     */
    @Test
    public void test5() throws TextDBException {
        String splitRegex = "学";
        String splitAttrName = TestConstantsChinese.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("北京大");
        splitResult.add("学电气工程");
        splitResult.add("学院");
        splitResult.add("北京大");
        splitResult.add("学计算机");
        splitResult.add("学院");
        splitResult.add("伟大的建筑是历史的坐标，具有传承的价值。");
        
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.GROUP_RIGHT);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsChinese.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());

        Assert.assertEquals(splitResult, splitStrings);
    }
    
    /*
     * Group the pattern string to the left tuple for dividing TextField.
     */
    @Test
    public void test6() throws TextDBException {
        String splitRegex = "学";
        String splitAttrName = TestConstantsChinese.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("北京大学");
        splitResult.add("电气工程学");
        splitResult.add("院");
        splitResult.add("北京大学");
        splitResult.add("计算机学");
        splitResult.add("院");
        splitResult.add("伟大的建筑是历史的坐标，具有传承的价值。");
        
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.GROUP_LEFT);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsChinese.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());

        Assert.assertEquals(splitResult, splitStrings);
    }
    
    /*
     * Group the pattern string to a standalone tuple for dividing TextField.
     */
    @Test
    public void test7() throws TextDBException {
        String splitRegex = "学";
        String splitAttrName = TestConstantsChinese.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("北京大");
        splitResult.add("学");
        splitResult.add("电气工程");
        splitResult.add("学");
        splitResult.add("院");
        splitResult.add("北京大");
        splitResult.add("学");
        splitResult.add("计算机");
        splitResult.add("学");
        splitResult.add("院");
        splitResult.add("伟大的建筑是历史的坐标，具有传承的价值。");
        
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.STANDALONE);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsChinese.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());

        Assert.assertEquals(splitResult, splitStrings);
    }
    
    /*
     * Pattern was whole match to the text.
     * It will return the whole text as a tuple field.
     */
    @Test
    public void test8() throws TextDBException {
        String splitRegex = "北京大学电气工程学院";
        String splitAttrName = TestConstantsChinese.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("北京大学电气工程学院");
        splitResult.add("北京大学计算机学院");
        splitResult.add("伟大的建筑是历史的坐标，具有传承的价值。");
        
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.STANDALONE);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsChinese.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());

        Assert.assertEquals(splitResult, splitStrings);
    }

    /*
     * No match to the text.
     * It will return the whole text as one tuple field.
     */
    @Test
    public void test9() throws TextDBException {
        String splitRegex = "美利坚合众国";
        String splitAttrName = TestConstantsChinese.DESCRIPTION;
        
        List<String> splitResult = new ArrayList<>();
        splitResult.add("北京大学电气工程学院");
        splitResult.add("北京大学计算机学院");
        splitResult.add("伟大的建筑是历史的坐标，具有传承的价值。");
        
        List<Tuple> results = getRegexSplitResults(CHINESE_TABLE, splitRegex, splitAttrName, 
                RegexSplitPredicate.SplitType.STANDALONE);
        
        List<String> splitStrings = results.stream()
                .map(tuple -> tuple.getField(TestConstantsChinese.DESCRIPTION).getValue().toString())
                .collect(Collectors.toList());

        Assert.assertEquals(splitResult, splitStrings);
    }

}
