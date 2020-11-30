package edu.uci.ics.amber.engine.architecture.worker.neo

import java.util.concurrent.{ExecutorService, Executors, Future}

import akka.actor.{Actor, ActorRef}
import edu.uci.ics.amber.engine.architecture.breakpoint.localbreakpoint.ExceptionBreakpoint
import edu.uci.ics.amber.engine.architecture.worker.BreakpointSupport
import edu.uci.ics.amber.engine.common.amberexception.BreakpointException
import edu.uci.ics.amber.engine.common.ambermessage.ControlMessage.LocalBreakpointTriggered
import edu.uci.ics.amber.engine.common.ambermessage.WorkerMessage.ExecutionCompleted
import edu.uci.ics.amber.engine.common.{IOperatorExecutor, InputExhausted}
import edu.uci.ics.amber.engine.common.tuple.ITuple


class DataProcessor(                             // dependencies:
                     operator: IOperatorExecutor,// core logic
                     tupleInput: TupleInput,     // to get input tuples
                     tupleOutput: TupleOutput,   // to send output tuples
                     pauseUtil: PauseUtil,       // to pause/resume
                     self:ActorRef               // to notify main actor
                   ) extends BreakpointSupport { // TODO: make breakpointSupport as a module

  private[this] def funToRunnable(fun: () => Unit): Runnable = new Runnable() { def run(): Unit = fun() }

  // dp thread
  private val executorService: ExecutorService = Executors.newSingleThreadExecutor

  // dp thread stats:
  private var inputTupleCount = 0L
  private var outputTupleCount = 0L
  private var currentInputTuple: Either[ITuple, InputExhausted] = _

  // initialize dp thread upon construction
  // we can use dpThreadFuture to kill dp thread if needed
  private val dpThreadFuture: Future[_] = executorService.submit(funToRunnable(
    () => {
      try {
        this.dpThread()
      } catch {
        case e: Exception =>
          throw new RuntimeException(e)
      }
    }))


  /** provide API for actor to get stats of this operator
    * @return (input tuple count, output tuple count)
    */
  def collectStatistics():(Long,Long) = (inputTupleCount, outputTupleCount)

  /** provide API for actor to get current input tuple of this operator
    * @return current input tuple if it exists
    */
  def getCurrentInputTuple: ITuple = {
    if(currentInputTuple != null && currentInputTuple.isLeft){
      currentInputTuple.left.get
    }else{
      null
    }
  }

  /** process currentInputTuple through operator logic.
    * @return an iterator of output tuples
    */
  private[this] def consumeOneTuple(): Iterator[ITuple] = {
    var outputIterator:Iterator[ITuple] = null
    try{
      outputIterator = operator.processTuple(currentInputTuple, tupleInput.getCurrentInput)
      if(currentInputTuple.isLeft) inputTupleCount += 1
    }catch{
      case e:Exception =>
        handleOperatorException(e, isInput = true)
    }
    outputIterator
  }

  /** transfer one tuple from iterator to downstream.
    * @param outputIterator
    */
  private[this] def outputOneTuple(outputIterator:Iterator[ITuple]): Unit = {
    var outputTuple: ITuple = null
    try{
      outputTuple = outputIterator.next
    }catch{
      case e:Exception =>
        handleOperatorException(e, isInput = true)
    }
    if (outputTuple != null){
      try{
        outputTupleCount += 1
        tupleOutput.transferTuple(outputTuple, outputTupleCount)
      }catch{
        case bp:BreakpointException =>
          pauseUtil.pause(PauseUtil.Breakpoint)
          self ! LocalBreakpointTriggered // TODO: apply FIFO & exactly-once protocol here
        case e: Exception =>
          handleOperatorException(e,isInput = false)
      }
    }
  }

  /** Provide main functionality of data processing
    * @throws Exception (from engine code only)
    */
  @throws[Exception]
  private[this] def dpThread(): Unit = {
    // main DP loop: runs until all upstreams exhaust.
    while (!tupleInput.isAllUpstreamsExhausted) {
      // take the next input tuple from tupleInput, blocks if no tuple available.
      currentInputTuple = tupleInput.nextInputTuple()
      // check pause before processing the input tuple.
      pauseUtil.pauseCheck()
      // pass input tuple to operator logic.
      val outputIterator = consumeOneTuple()
      // check pause before outputting tuples.
      pauseUtil.pauseCheck()
      // output loop: take one tuple from iterator at a time.
      while (outputIterator != null && outputIterator.hasNext) {
        // send tuple to downstream.
        outputOneTuple(outputIterator)
        // check pause after one tuple has been outputted.
        pauseUtil.pauseCheck()
      }
    }
    // Send Completed signal to worker actor.
    self ! ExecutionCompleted // TODO: apply FIFO & exactly-once protocol here
  }


  // For compatibility, we use old breakpoint handling logic
  // TODO: remove this when we refactor breakpoints
  private[this] def assignExceptionBreakpoint(faultedTuple:ITuple, e:Exception, isInput:Boolean): Unit ={
    breakpoints(0).triggeredTuple = faultedTuple
    breakpoints(0).asInstanceOf[ExceptionBreakpoint].error = e
    breakpoints(0).triggeredTupleId = outputTupleCount
    breakpoints(0).isInput = isInput
  }


  private[this] def handleOperatorException(e:Exception, isInput:Boolean): Unit ={
    pauseUtil.pause(PauseUtil.Breakpoint)
    assignExceptionBreakpoint(currentInputTuple.left.getOrElse(null), e, isInput)
    self ! LocalBreakpointTriggered // TODO: apply FIFO & exactly-once protocol here
  }

}