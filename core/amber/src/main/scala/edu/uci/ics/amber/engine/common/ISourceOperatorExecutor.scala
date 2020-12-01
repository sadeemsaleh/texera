package edu.uci.ics.amber.engine.common

import edu.uci.ics.amber.engine.common.tuple.ITuple

trait ISourceOperatorExecutor extends IOperatorExecutor {

  override def processTuple(tuple: Either[ITuple, InputExhausted], input: Int): Iterator[ITuple] = {
    // By calling produce() here,
    // the DP thread can use the same processing logic for both source and other operators.
    // The input Tuple for source operator will always be Either(InputExhausted)
    // and produce() will be called only once.
    produce()
  }

  def produce(): Iterator[ITuple]

}
