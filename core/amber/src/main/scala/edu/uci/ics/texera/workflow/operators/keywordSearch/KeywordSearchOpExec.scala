package edu.uci.ics.texera.workflow.operators.keywordSearch

import edu.uci.ics.texera.workflow.common.operators.filter.FilterOpExec
import edu.uci.ics.texera.workflow.common.tuple.Tuple

import scala.collection.immutable

import org.apache.lucene.search.BooleanQuery
import org.apache.lucene.index.Term
import org.apache.lucene.search.TermQuery
import org.apache.lucene.search.BooleanClause

class KeywordSearchOpExec(val opDesc: KeywordSearchOpDesc) extends FilterOpExec {
  val kw: String = opDesc.keyword
  val kwSplit: immutable.Seq[String] = kw.split(" ").toList

//  val totalQuery = new BooleanQuery
//  val kwQuery = new BooleanQuery

  if (kwSplit.size == 1) {
    this.setFilterFunc(this.findKeyword)
  }
//  else {
////    val catQuery1 = new TermQuery(new Term(opDesc.columnName, kwSplit(0)))
////    val catQuery2 = new TermQuery(new Term(opDesc.columnName, kwSplit(2)))
////    kwQuery.add(new BooleanClause(catQuery1, BooleanClause.Occur.SHOULD))
////    kwQuery.add(new BooleanClause(catQuery2, BooleanClause.Occur.SHOULD))
//
//    val catQuery1 = new TermQuery(new Term(opDesc.columnName, kw))
//    kwQuery.add(new BooleanClause(catQuery1, BooleanClause.Occur.SHOULD))
//
//    totalQuery.add(new BooleanClause(kwQuery, BooleanClause.Occur.MUST))
//    this.setFilterFunc(this.findOrKeyword)
//  }

  def findKeyword(tuple: Tuple): Boolean = {
    val tupleValue = tuple.getField(opDesc.columnName).toString
    tupleValue == kw
  }

//  def findOrKeyword(tuple: Tuple): Boolean = {
//    val tupleValue = tuple.getField(opDesc.columnName).toString
//    println(kwQuery)
//    println(totalQuery)
//    tupleValue contains totalQuery
//  }

}
