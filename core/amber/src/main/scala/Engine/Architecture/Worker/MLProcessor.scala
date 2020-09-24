package Engine.Architecture.Worker

import java.util.concurrent.Executors

import Engine.Architecture.Breakpoint.FaultedTuple
import Engine.Architecture.Breakpoint.LocalBreakpoint.{ExceptionBreakpoint, LocalBreakpoint}
import Engine.Architecture.ReceiveSemantics.FIFOAccessPort
import Engine.Common.AmberException.{AmberException, BreakpointException}
import Engine.Common.AmberMessage.WorkerMessage._
import Engine.Common.AmberMessage.StateMessage._
import Engine.Common.AmberMessage.ControlMessage.{QueryState, _}
import Engine.Common.AmberTag.{LayerTag, WorkerTag}
import Engine.Common.AmberTuple.{AmberTuple, Tuple}
import Engine.Common.{
  AdvancedMessageSending,
  Constants,
  ElidableStatement,
  TableMetadata,
  ThreadState,
  TupleProcessor
}
import Engine.Operators.Filter.{FilterMetadata, FilterSpecializedTupleProcessor, FilterType}
import Engine.Operators.KeywordSearch.{KeywordSearchMetadata, KeywordSearchTupleProcessor}
import Engine.Common.{
  AdvancedMessageSending,
  ElidableStatement,
  TableMetadata,
  ThreadState,
  TupleProcessor
}
import Engine.Operators.Sink.SimpleSinkProcessor
import Engine.FaultTolerance.Recovery.RecoveryPacket
import Engine.Operators.Common.Filter.{FilterGeneralMetadata, FilterGeneralTupleProcessor}
import Engine.Operators.OperatorMetadata
import akka.actor.{Actor, ActorLogging, ActorRef, Props, Stash}
import akka.event.LoggingAdapter
import akka.pattern.ask
import akka.util.Timeout
import com.github.nscala_time.time.Imports._
import play.api.libs.json.{JsValue, Json}

import scala.collection.mutable
import scala.concurrent.{ExecutionContext, ExecutionContextExecutor, Future}
import scala.util.control.Breaks
import scala.annotation.elidable
import scala.annotation.elidable._
import scala.concurrent.duration._

object MLProcessor {
  def props(processor: TupleProcessor, tag: WorkerTag): Props = Props(new MLProcessor(processor, tag))
}

class MLProcessor(var ml_dataProcessor: TupleProcessor, val ml_tag: WorkerTag) extends Processor(ml_dataProcessor, ml_tag) {

  var epochCount = 0
  val MAX_EPOCHS = 10000

  override def processBatch(): Unit = {
    Breaks.breakable {
      beforeProcessingBatch()
      processStart = System.nanoTime()
      val (from, batch) = synchronized { processingQueue.front }
      //check if there is tuple left to be outputted
      while (dataProcessor.hasNext) {
        exitIfPaused()
        var nextTuple: Tuple = null
        try {
          nextTuple = dataProcessor.next()
        } catch {
          case e: Exception =>
            if (breakpoints.nonEmpty) {
              synchronized {
                dPThreadState = ThreadState.LocalBreakpointTriggered
              }
              self ! LocalBreakpointTriggered
              breakpoints(0).triggeredTuple = currentInputTuple
              breakpoints(0).asInstanceOf[ExceptionBreakpoint].error = e
              breakpoints(0).triggeredTupleId = generatedCount
              breakpoints(0).isInput = true
              processTime += System.nanoTime() - processStart
              Breaks.break()
            }
        }
        try {
          generatedCount += 1
          transferTuple(nextTuple, generatedCount)
        } catch {
          case e: BreakpointException =>
            synchronized {
              dPThreadState = ThreadState.LocalBreakpointTriggered
            }
            self ! LocalBreakpointTriggered
            processTime += System.nanoTime() - processStart
            Breaks.break()
          case e: Exception =>
            self ! ReportFailure(e)
            processTime += System.nanoTime() - processStart
            Breaks.break()
        }
      }
      if (batch == null) {
        while(epochCount < MAX_EPOCHS) {
          println(s"Epoch $epochCount")
          exitIfPaused()
          dataProcessor.onUpstreamExhausted(from)
          epochCount += 1
        }
        self ! ReportUpstreamExhausted(from)
        aliveUpstreams.remove(from)
      } else {
        dataProcessor.onUpstreamChanged(from)
        //no tuple remains, we continue
//        while (processingIndex < batch.length) {
          exitIfPaused()
          try {
//            currentInputTuple = batch(processingIndex)
//            if (!skippedInputTuples.contains(currentInputTuple)) {
//              dataProcessor.accept(currentInputTuple)
//            }
            dataProcessor.acceptBatch(batch)
            processedCount += 1
          } catch {
            case e: Exception =>
              if (breakpoints.nonEmpty) {
                synchronized {
                  dPThreadState = ThreadState.LocalBreakpointTriggered
                }
                self ! LocalBreakpointTriggered
                breakpoints(0).triggeredTuple = currentInputTuple
                breakpoints(0).asInstanceOf[ExceptionBreakpoint].error = e
                breakpoints(0).asInstanceOf[ExceptionBreakpoint].isInput = true
                breakpoints(0).triggeredTupleId = processedCount
                breakpoints(0).isInput = true
                processTime += System.nanoTime() - processStart
                Breaks.break()
              }
            case other: Any =>
              println(other)
              println(batch(processingIndex))
          }
          processingIndex += 1
//          exitIfPaused()
//          while (dataProcessor.hasNext) {
//            exitIfPaused()
//            var nextTuple: Tuple = null
//            try {
//              nextTuple = dataProcessor.next()
//            } catch {
//              case e: Exception =>
//                if (breakpoints.nonEmpty) {
//                  synchronized {
//                    dPThreadState = ThreadState.LocalBreakpointTriggered
//                  }
//                  self ! LocalBreakpointTriggered
//                  breakpoints(0).triggeredTuple = currentInputTuple
//                  breakpoints(0).asInstanceOf[ExceptionBreakpoint].error = e
//                  breakpoints(0).triggeredTupleId = generatedCount
//                  breakpoints(0).isInput = true
//                  processTime += System.nanoTime() - processStart
//                  Breaks.break()
//                }
//            }
//            try {
//              generatedCount += 1
//              transferTuple(nextTuple, generatedCount)
//              exitIfPaused()
//            } catch {
//              case e: BreakpointException =>
//                synchronized {
//                  dPThreadState = ThreadState.LocalBreakpointTriggered
//                }
//                self ! LocalBreakpointTriggered
//                processTime += System.nanoTime() - processStart
//                Breaks.break()
//              case e: Exception =>
//                log.info(e.toString)
//                self ! ReportFailure(e)
//                processTime += System.nanoTime() - processStart
//                Breaks.break()
//            }
//          }
//        }
      }
      afterProcessingBatch()
      processTime += System.nanoTime() - processStart
    }
  }

}
