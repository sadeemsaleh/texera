package edu.uci.ics.texera.workflow.operators.mlperceptron;

import edu.uci.ics.texera.workflow.common.operators.mlmodel.MLModelOpExec;
import edu.uci.ics.texera.workflow.common.tuple.Tuple;

import java.util.ArrayList;
import java.util.List;

public class MLPerceptronOpExec extends MLModelOpExec{

  private String x1Idx;
  private String x2Idx;
  private String yIdx;
  private float learningRate = 0.1f;


  private MLPerceptron mlp = null;
  private List<float[]> results = null;

  MLPerceptronOpExec(String x1Idx, String x2Idx, String yIdx, int[] layerSizes, float learningRate){
    this.x1Idx = x1Idx;
    this.x2Idx = x2Idx;
    this.yIdx = yIdx;

    mlp = new MLPerceptron(layerSizes);
    this.learningRate = learningRate;
  }

  @Override
  public int getTotalEpochsCount() {
    return 100;
  }

  @Override
  public void predict(Tuple[] minibatch) {
    results = new ArrayList<>();
    for(Tuple t: minibatch) {
      Float x1 = Float.valueOf(t.getField(x1Idx));
      Float x2 = Float.valueOf(t.getField(x2Idx));
      float[] inputs = new float[]{x1,x2};
      results.add(mlp.evaluate(inputs));
    }
  }

  @Override
  public void calculateLossGradient(Tuple[] minibatch) {
    mlp.resetWeightsDelta();
    int tIdx = 0;
    for(float[] result: results) {
      mlp.evaluateGradients(result);
      mlp.evaluateWeightsDelta();
    }
  }

  @Override
  public void readjustWeight() {
    mlp.updateWeights(learningRate);
  }
}
