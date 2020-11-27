package edu.uci.ics.amber.engine.common

import edu.uci.ics.amber.engine.common.tuple.ITuple

trait ISourceOperatorExecutor extends IOperatorExecutor {

  override def processTuple(tuple: Either[ITuple, InputExhausted], input: Int): Iterator[ITuple] = {
     produce()
  }

  def produce(): Iterator[ITuple]

}
