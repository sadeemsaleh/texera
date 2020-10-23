package edu.uci.ics.texera.workflow.common.operators.projection

import edu.uci.ics.amber.engine.operators.OpExecConfig
import edu.uci.ics.texera.workflow.common.metadata.{OperatorGroupConstants, OperatorInfo}
import edu.uci.ics.texera.workflow.common.operators.OneToOneOpExecConfig
import edu.uci.ics.texera.workflow.common.operators.map.MapOpDesc
import edu.uci.ics.texera.workflow.common.tuple.schema.Schema

class ProjectionOpDesc extends MapOpDesc{
  override def operatorExecutor: OneToOneOpExecConfig = ???

  override def operatorInfo: OperatorInfo = OperatorInfo(
    userFriendlyName = "Projection",
    operatorDescription = "Search a regular expression in a string column",
    operatorGroupName = OperatorGroupConstants.SEARCH_GROUP,
    numInputPorts = 1,
    numOutputPorts = 1
  )

  override def getOutputSchema(schemas: Array[Schema]): Schema = ???
}
