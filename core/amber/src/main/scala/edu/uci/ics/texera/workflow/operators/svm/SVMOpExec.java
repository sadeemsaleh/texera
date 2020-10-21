package edu.uci.ics.texera.workflow.operators.svm;

import edu.uci.ics.texera.workflow.common.operators.mlmodel.MLModelOpExec;
import edu.uci.ics.texera.workflow.common.tuple.Tuple;

/**
 * Implemented as per https://towardsdatascience.com/support-vector-machine-introduction-to-machine-learning-algorithms-934a444fca47
 */

public class SVMOpExec extends MLModelOpExec{

  private String x1Attr;
  private String x2Attr;
  private String yAttr;

  private double learningRate = 0.1;
  private double w1_current = 0;
  private double w2_current = 0;
  private double regularization_param = 1.0/getTotalEpochsCount();

  private Double[] results = null;
  private double w1_gradient = 0;
  private double w2_gradient = 0;

  SVMOpExec(String x1Attr, String x2Attr, String yAttr, double learningRate){
    this.x1Attr = x1Attr;
    this.x2Attr = x2Attr;
    this.yAttr = yAttr;
    this.learningRate = learningRate;
  }

  @Override
  public int getTotalEpochsCount() {
    return 100;
  }

  @Override
  public void predict(Tuple[] minibatch) {
    results = new Double[minibatch.length];

    int tIdx = 0;
    for(Tuple t: minibatch) {
      Double x1 = Double.valueOf(t.getField(x1Attr));
      Double x2 = Double.valueOf(t.getField(x2Attr));
      results[tIdx] = (w1_current * x1) + (w2_current * x2);
      tIdx++;
    }
  }

  @Override
  public void calculateLossGradient(Tuple[] minibatch) {
    double n = minibatch.length * 1.0;
    w1_gradient = 0;
    w2_gradient = 0;
    int tIdx = 0;
    for(Double result: results) {
      Double x1 = Double.valueOf(minibatch[tIdx].getField(x1Attr));
      Double x2 = Double.valueOf(minibatch[tIdx].getField(x2Attr));
      Double y = Double.valueOf(minibatch[tIdx].getField(yAttr));

      Double product = y * result;
      if(product>=1) {
        w1_gradient += 2*regularization_param*w1_current;
        w2_gradient += 2*regularization_param*w2_current;
      } else {
        w1_gradient += 2*regularization_param*w1_current - y*x1;
        w1_gradient += 2*regularization_param*w1_current - y*x2;
      }
      tIdx++;
    }
    w1_gradient = Math.round(w1_gradient*100.0)/100.0;
    w2_gradient = Math.round(w2_gradient*100.0)/100.0;
  }

  @Override
  public void readjustWeight() {
    w1_current = w1_current - (learningRate * w1_gradient);
    w2_current = w2_current - (learningRate * w2_gradient);
    w1_current = Math.round(w1_current*100.0)/100.0;
    w2_current = Math.round(w2_current*100.0)/100.0;

    System.out.println("Epoch "+ currentEpoch() + " Learning Rate " + learningRate + ", Current w and b values are : " + w1_current + " " + w2_current);
  }
}
