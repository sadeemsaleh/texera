package edu.uci.ics.texera.workflow.operators.visualization.linearRegressionChart

import edu.uci.ics.amber.engine.common.InputExhausted
import edu.uci.ics.texera.workflow.common.operators.OperatorExecutor
import edu.uci.ics.texera.workflow.common.tuple.Tuple

class LinearRegressionChartOpExec extends OperatorExecutor {

  override def processTexeraTuple(tuple: Either[Tuple, InputExhausted], input: Int): Iterator[Tuple] = {
    tuple match {
      case Left(t) =>
        val x: java.lang.Double = t.getField("x")
        val w: java.lang.Double = t.getField("w")
        val b: java.lang.Double = t.getField("b")
        val y: java.lang.Double = w * x + b
        val fields: Array[AnyRef] = Array(x, y)
        Iterator(Tuple.newBuilder().add(LinearRegressionChartOpDesc.schema, fields).build())
      case Right(_) => Iterator()
    }
  }

  override def open(): Unit = {}

  override def close(): Unit = {}
}
