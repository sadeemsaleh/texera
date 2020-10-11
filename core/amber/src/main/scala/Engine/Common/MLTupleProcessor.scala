package Engine.Common

import java.util
import java.util.{ArrayList, List}

import Engine.Common.AmberTag.LayerTag
import Engine.Common.AmberTuple.Tuple

abstract class MLTupleProcessor extends TupleProcessor {

  var allBatches: util.List[Array[Tuple]] = new util.ArrayList[Array[Tuple]]

  def setLearningRate(rate: Double): Unit

  def acceptBatch(batch: Array[Tuple]): Unit = {
    allBatches.add(batch)
  }

  override def onUpstreamExhausted(from: LayerTag): Unit = {
    allBatches.forEach(minibatch => {
      predict(minibatch)
      calculateLossGradient(minibatch)
      readjustWeight()
    })
  }

  def predict(minibatch: Array[Tuple]): Unit
  def calculateLossGradient(minibatch: Array[Tuple]): Unit
  def readjustWeight(): Unit
}
