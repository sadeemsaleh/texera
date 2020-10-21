package edu.uci.ics.texera.workflow.operators.svm

import com.fasterxml.jackson.annotation.{JsonProperty, JsonPropertyDescription}
import edu.uci.ics.texera.workflow.common.metadata.{OperatorGroupConstants, OperatorInfo}
import edu.uci.ics.texera.workflow.common.operators.mlmodel.{MLModelOpDesc, MLModelOpExecConfig}

class SVMOpDesc extends MLModelOpDesc {

  @JsonProperty(value= "x1 attribute", required = true)
  @JsonPropertyDescription("column representing x1 in input of SVM y=w1*x1 + w2*x2")
  var x1Attr: String = _

  @JsonProperty(value= "x2 attribute", required = true)
  @JsonPropertyDescription("column representing x2 in input of SVM y=w1*x1 + w2*x2")
  var x2Attr: String = _

  @JsonProperty(value = "y attribute", required = true)
  @JsonPropertyDescription("column representing output of SVM")
  var yAttr: String = _

  @JsonProperty(value = "learning rate", required = true)
  @JsonPropertyDescription("Learning Rate")
  var learningRate: Float = _

  override def operatorExecutor = new MLModelOpExecConfig(this.operatorIdentifier, 1, () => new SVMOpExec(x1Attr, x2Attr, yAttr, learningRate))

  override def operatorInfo = OperatorInfo("SVM", "Trains a SVM model y=w1*x1 + w2*x2", OperatorGroupConstants.UTILITY_GROUP, 1, 1)
}
