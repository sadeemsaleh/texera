package Engine.Operators.MLPerceptron;

import Engine.Common.AmberTag.LayerTag;
import Engine.Common.AmberTuple.Tuple;
import Engine.Common.MLTupleProcessor;

import java.util.ArrayList;
import java.util.List;

public class MLPerceptronTupleProcessor extends MLTupleProcessor {

    private Tuple tuple = null;
    private boolean nextFlag = false;
    private int x1Idx = -1;
    private int x2Idx = -1;
    private int yIdx = -1;
    private float learningRate = 0.1f;

    private List<Tuple> allData = new ArrayList<>();
    private MLPerceptron mlp = null;
    private List<float[]> results = null;

    MLPerceptronTupleProcessor(int x1Idx, int x2Idx, int yIdx, int[] layerSizes, float learningRate){
        this.x1Idx = x1Idx;
        this.x2Idx = x2Idx;
        this.yIdx = yIdx;

        mlp = new MLPerceptron(layerSizes);
        this.learningRate = learningRate;
    }

    @Override
    public void setLearningRate(double rate) {
        learningRate = (float)rate;
    }

    @Override
    public void accept(Tuple tuple) {
        allData.add(tuple);
    }

    @Override
    public void predict(Tuple[] minibatch) {
        results = new ArrayList<>();
        for(Tuple t: minibatch) {
            Float x1 = Float.valueOf(t.getString(x1Idx));
            Float x2 = Float.valueOf(t.getString(x2Idx));
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

    @Override
    public void onUpstreamChanged(LayerTag from) {

    }

    @Override
    public void noMore() {
        // Do Linear regression stuff here

    }

    @Override
    public void initialize() {

    }

    @Override
    public boolean hasNext() {
        return nextFlag;
    }

    @Override
    public Tuple next() {
        nextFlag = false;
        return tuple;
    }

    @Override
    public void dispose() {

    }
}
