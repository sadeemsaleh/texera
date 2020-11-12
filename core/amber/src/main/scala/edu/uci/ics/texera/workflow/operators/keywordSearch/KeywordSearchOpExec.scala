package edu.uci.ics.texera.workflow.operators.keywordSearch

import edu.uci.ics.texera.workflow.common.operators.filter.FilterOpExec
import edu.uci.ics.texera.workflow.common.tuple.Tuple
import org.apache.lucene.queryparser.classic.QueryParser
import org.apache.lucene.analysis.core.SimpleAnalyzer
import org.apache.lucene.index.memory.MemoryIndex


class KeywordSearchOpExec(val opDesc: KeywordSearchOpDesc) extends FilterOpExec {
  var kw: String = opDesc.keyword
  this.setFilterFunc(this.findKeyword)

  def findKeyword(tuple: Tuple): Boolean = {
    val tupleValue = tuple.getField(opDesc.columnName).toString
    val analyzer = new SimpleAnalyzer()
    val index = new MemoryIndex()
    index.addField(opDesc.columnName, tupleValue, analyzer)
    val parser = new QueryParser(opDesc.columnName, analyzer)
    val score = index.search(parser.parse(kw))
    if (score > 0.0f) true
    else false
  }
}