package edu.uci.ics.texera.workflow.operators.keywordSearch

import edu.uci.ics.texera.workflow.common.operators.filter.FilterOpExec
import edu.uci.ics.texera.workflow.common.tuple.Tuple
import org.apache.lucene.analysis.Analyzer
import org.apache.lucene.analysis.standard.StandardAnalyzer
import scala.collection.immutable
import org.apache.lucene.search.{BooleanQuery, Query, TermQuery}
import org.apache.lucene.queryparser.classic.QueryParser
import org.apache.lucene.search.BooleanClause.Occur._


class KeywordSearchOpExec(val opDesc: KeywordSearchOpDesc) extends FilterOpExec {
  var kw: String = opDesc.keyword
  val kwSplit: immutable.Seq[String] = kw.split(" ").toList

  // Determines whether to search for one keyword or multiple
  if (kwSplit.size == 1) {
    this.setFilterFunc(this.findKeyword)
  }
  else {
    this.setFilterFunc(this.findAllKeywords)
  }

  // Function to find one keyword
  def findKeyword(tuple: Tuple): Boolean = {
    val tupleValue = tuple.getField(opDesc.columnName).toString
    tupleValue contains kw
  }

  // Function to find multiple keywords with a boolean expression
  // Uses Lucene Analyzer, TextQuery, BooleanQuery, and QueryParser
  def findAllKeywords(tuple: Tuple): Boolean = {
    val tupleValue = tuple.getField(opDesc.columnName).toString
    val analyzer = new StandardAnalyzer
    val textQuery = TextQuery(analyzer, opDesc.columnName, kw)

    if (assert(textQuery.fromString(kw).match_boolean(tupleValue)).toString == "()") {
      true
    }
    else {
      false
    }
  }
}

// Class to parse and evaluate boolean expression input
case class TextQuery(analyzer: Analyzer, columnName: String, kw: String) {
  val parser = new QueryParser(columnName, analyzer)

  // Parses entire boolean expression into individual expressions
  def fromString(kw: String) = {
    val q = parser.parse(kw)
    QueryMatcher(q)
  }

  // Evaluates each individual boolean expression recursively
  case class QueryMatcher(query: Query) {
    def match_boolean(text: String): Boolean = {
      assert(query.toString != "", "empty query")
      query match {
        case q: TermQuery =>
          text contains q.getTerm.text

        case q: BooleanQuery =>
          val clauses = q.getClauses
          val must = clauses.filter(_.getOccur == MUST).forall { c =>
            QueryMatcher(c.getQuery).match_boolean(text)
          }
          val mustNot = clauses.filter(_.getOccur == MUST_NOT).forall { c =>
            !QueryMatcher(c.getQuery).match_boolean(text)
          }
          val should = clauses.filter(_.getOccur == SHOULD) match {
            case cs if cs.size == 0 => true
            case cs => cs.exists(c => QueryMatcher(c.getQuery).match_boolean(text))
          }
          must && mustNot && should

        case _ => false
          sys.error("not supported " + query.getClass)
      }
    }
  }
}


