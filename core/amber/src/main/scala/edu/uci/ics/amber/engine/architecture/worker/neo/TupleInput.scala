package edu.uci.ics.amber.engine.architecture.worker.neo

import edu.uci.ics.amber.engine.common.InputExhausted
import edu.uci.ics.amber.engine.common.tuple.ITuple

class TupleInput(batchInput: BatchInput){

  // save current batch related information
  private var currentBatch:(Int, Array[ITuple]) = _
  private var currentTupleIndex = 0

  // indicate if all upstreams exhausted
  private var allExhausted = false
  private var inputExhaustedCount = 0

  /** get next input tuple
    * should only be called from dp thread
    * @return tuple
    */
  def nextInputTuple():Either[ITuple, InputExhausted] ={
    // increment cursor
    currentTupleIndex += 1
    // if batch is unavailable, take one from batchInput and reset cursor
    if(currentBatch == null || currentTupleIndex >= currentBatch._2.length){
      currentTupleIndex = 0
      currentBatch = batchInput.WorkerInternalQueue.take()
    }
    // if current batch is a data batch, return tuple
    if(currentBatch._2 != null) {
      Left(currentBatch._2(currentTupleIndex))
    }else{
      // current batch is an End of Data sign.
      inputExhaustedCount += 1
      // check if End of Data sign from every upstream has been received
      allExhausted = batchInput.inputMap.size == inputExhaustedCount
      // return InputExhausted
      Right(InputExhausted())
    }
  }

  def getCurrentInput:Int = currentTupleIndex

  def isAllUpstreamsExhausted:Boolean = allExhausted
}

