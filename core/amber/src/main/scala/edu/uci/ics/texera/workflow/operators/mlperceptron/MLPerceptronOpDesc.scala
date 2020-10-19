package edu.uci.ics.texera.workflow.operators.mlperceptron

import com.fasterxml.jackson.annotation.{JsonProperty, JsonPropertyDescription}
import edu.uci.ics.texera.workflow.common.metadata.{OperatorGroupConstants, OperatorInfo}
import edu.uci.ics.texera.workflow.common.operators.mlmodel.{MLModelOpDesc, MLModelOpExecConfig}

class MLPerceptronOpDesc extends MLModelOpDesc {

  @JsonProperty(value= "x1 attribute", required = true)
  @JsonPropertyDescription("column representing x1 in input of MLP")
  var x1Attr: String = _

  @JsonProperty(value= "x2 attribute", required = true)
  @JsonPropertyDescription("column representing x2 in input of MLP")
  var x2Attr: String = _

  @JsonProperty(value = "y attribute", required = true)
  @JsonPropertyDescription("column representing y in y=wx+b")
  var yAttr: String = _

  @JsonProperty(value = "learning rate", required = true)
  @JsonPropertyDescription("Learning Rate")
  var learningRate: Float = _

  override def operatorExecutor = new MLModelOpExecConfig(this.operatorIdentifier, 1, () => new MLPerceptronOpExec(x1Attr, x2Attr, yAttr, Array(2,6,1), learningRate))

  override def operatorInfo = OperatorInfo("Multi-layer Perceptron", "Trains a Multi-layer Perceptron model", OperatorGroupConstants.UTILITY_GROUP, 1, 1)
}
