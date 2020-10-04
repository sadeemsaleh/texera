package web.model.event

import Engine.Operators.OperatorMetadata

case class QueryOperatorInternalStateEvent(states: Map[(OperatorMetadata, String), List[String]])
  extends TexeraWsEvent