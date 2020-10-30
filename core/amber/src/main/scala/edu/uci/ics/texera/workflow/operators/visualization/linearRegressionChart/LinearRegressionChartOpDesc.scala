package edu.uci.ics.texera.workflow.operators.visualization.linearRegressionChart

import edu.uci.ics.amber.engine.operators.OpExecConfig
import edu.uci.ics.texera.workflow.common.metadata.{OperatorGroupConstants, OperatorInfo}
import edu.uci.ics.texera.workflow.common.operators.{OneToOneOpExecConfig, OperatorDescriptor}
import edu.uci.ics.texera.workflow.common.tuple.schema.{AttributeType, Schema}
import edu.uci.ics.texera.workflow.operators.visualization.{VisualizationConstants, VisualizationOpDesc}
import edu.uci.ics.texera.workflow.operators.visualization.lineChart.LineChartEnum

object LinearRegressionChartOpDesc {
  val schema: Schema = Schema.newBuilder()
    .add("x", AttributeType.DOUBLE)
    .add("y", AttributeType.DOUBLE)
    .build()
}

class LinearRegressionChartOpDesc extends VisualizationOpDesc {

  override def operatorExecutor: OpExecConfig = {
    new OneToOneOpExecConfig(this.operatorIdentifier, _ => new LinearRegressionChartOpExec)
  }

  override def operatorInfo: OperatorInfo = OperatorInfo(
    "Linear Regression Chart",
    "Visualize LinearRegression Result",
    OperatorGroupConstants.VISUALIZATION_GROUP,
    1, 1
  )

  override def getOutputSchema(schemas: Array[Schema]): Schema = {
    LinearRegressionChartOpDesc.schema
  }

  override def chartType(): String = VisualizationConstants.XYLINE
}
