package edu.uci.ics.texera.workflow.common.operators.mlmodel

import com.google.common.base.Preconditions
import edu.uci.ics.texera.workflow.common.operators.{OneToOneOpExecConfig, OperatorDescriptor}
import edu.uci.ics.texera.workflow.common.tuple.schema.Schema

abstract class MLModelOpDesc extends OperatorDescriptor {

  override def operatorExecutor: MLModelOpExecConfig

}
