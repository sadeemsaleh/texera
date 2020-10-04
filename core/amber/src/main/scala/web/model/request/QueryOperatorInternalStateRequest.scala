package web.model.request

import texera.common.workflow.TexeraOperator

case class QueryOperatorInternalStateRequest (operator: TexeraOperator, paramToQuery: String) extends TexeraWsRequest
