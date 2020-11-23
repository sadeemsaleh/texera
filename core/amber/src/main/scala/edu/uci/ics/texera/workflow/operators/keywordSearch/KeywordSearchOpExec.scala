package edu.uci.ics.texera.workflow.operators.keywordSearch

import java.io.{FileReader, IOException, StringReader}
import edu.uci.ics.texera.workflow.common.operators.filter.FilterOpExec
import edu.uci.ics.texera.workflow.common.tuple.Tuple
import org.apache.lucene.queryparser.classic.QueryParser
import org.apache.lucene.analysis.core.SimpleAnalyzer
import org.apache.lucene.index.memory.MemoryIndex
import org.apache.lucene.store.MMapDirectory
import java.nio.file.FileSystems
import java.nio.file.Paths
import java.sql.Timestamp
import java.util.Date
import org.apache.lucene.analysis.standard.StandardAnalyzer
import org.apache.lucene.document.{Document, Field, StringField, TextField}
import org.apache.lucene.index.{DirectoryReader, IndexWriter, IndexWriterConfig}
import org.apache.lucene.search.Query
import org.apache.lucene.search.IndexSearcher

class KeywordSearchOpExec(val opDesc: KeywordSearchOpDesc) extends FilterOpExec {
  var kw: String = opDesc.keyword
  this.setFilterFunc(this.findKeywordMMap)

  val analyzer = new SimpleAnalyzer()
  //  val analyzer = new StandardAnalyzer
  val parser = new QueryParser(opDesc.columnName, analyzer)

  def findKeyword(tuple: Tuple): Boolean = {
    val date1 = new Date
//    System.out.println("Start " + new Timestamp(date1.getTime))

    val tupleValue = tuple.getField(opDesc.columnName).toString
    val index = new MemoryIndex()
    index.addField(opDesc.columnName, tupleValue, analyzer)
    val score = index.search(parser.parse(kw))

    val date2 = new Date
//    System.out.println("End " + new Timestamp(date2.getTime))
    if (score > 0.0f) true
    else false
  }

  def findKeywordMMap(tuple: Tuple): Boolean = {
    def createIndex(): Unit = {
      //      val indexPath = "/Users/rohan/Downloads/tweetsIndex"
      val dataPath = "/Users/rohan/Downloads/subsetTweets.csv"

      System.out.println("Worker ID" + opDesc)

      val path = Paths.get(dataPath)
      val file = path.toFile

      val indexWriterConfig = new IndexWriterConfig(analyzer);

      val indexPath = "/Users/rohan/Downloads/tweetsIndex";

      val indexDirectory = new MMapDirectory(Paths.get(indexPath));

      val indexWriter = new IndexWriter(indexDirectory, indexWriterConfig);

      val document = new Document();

      val fileReader = new FileReader(file)

      document.add(new TextField("contents", fileReader));
      document.add(new StringField("path", file.getPath(), Field.Store.YES));
      document.add(new StringField("filename", file.getName(), Field.Store.YES));

      indexWriter.addDocument(document)
      fileReader.close()
      indexWriter.close
    }

    val indexPath = "/Users/rohan/Downloads/tweetsIndex";

    val indexDirectory = new MMapDirectory(Paths.get(indexPath));

    createIndex()

    val tupleValue = tuple.getField(opDesc.columnName).toString
    System.out.println(opDesc.columnName, tupleValue)

    val query: Query = new QueryParser(opDesc.columnName, analyzer).parse(kw)
//    val query: Query = new QueryParser(tupleValue, analyzer).parse(kw)

    val indexReader = DirectoryReader.open(indexDirectory)

    val searcher = new IndexSearcher(indexReader)

    val topDocs = searcher.search(query, 10)

    indexReader.close()

    if (topDocs.scoreDocs.size > 0) true
    else false
  }
}