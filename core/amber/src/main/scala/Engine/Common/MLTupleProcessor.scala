package Engine.Common

import Engine.Common.AmberTuple.Tuple

trait MLTupleProcessor extends TupleProcessor {
  def setLearningRate(rate: Double): Unit

  def acceptBatch(batch: Array[Tuple]): Unit
}
