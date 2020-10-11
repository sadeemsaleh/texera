package Engine.Operators.SVM;

import Engine.Common.AmberTag.LayerTag;
import Engine.Common.AmberTuple.Tuple;
import Engine.Common.MLTupleProcessor;

import java.util.ArrayList;
import java.util.List;

public class SVMTupleProcessor extends MLTupleProcessor {

    private Tuple tuple = null;
    private boolean nextFlag = false;
    private int x1Idx = -1;
    private int x2Idx = -1;
    private int yIdx = -1;
    private float learningRate = 0.1f;


    private List<Tuple> allData = new ArrayList<>();

    private Double[] results = null;

    SVMTupleProcessor(int x1Idx, int x2Idx, int yIdx, double learningRate){
        this.x1Idx = x1Idx;
        this.yIdx = yIdx;
        this.learningRate = (float)learningRate;
    }

    @Override
    public void accept(Tuple tuple) {
        allData.add(tuple);
    }

    @Override
    public void acceptBatch(Tuple[] batch) {
        super.allBatches().add(batch);
    }

    @Override
    public void onUpstreamChanged(LayerTag from) {

    }

    @Override
    public void setLearningRate(double rate) {
        learningRate = rate;
    }

    @Override
    public void predict(Tuple[] minibatch) {
        results = new Double[minibatch.length];

        int tIdx = 0;
        for(Tuple t: minibatch) {
            Double x = Double.valueOf(t.getString(xIdx));
            results[tIdx] = (w_current * x) + b_current;
            tIdx++;
        }
    }

    @Override
    public void calculateLossGradient(Tuple[] minibatch) {
        double n = minibatch.length * 1.0;
        w_gradient = 0;
        b_gradient = 0;
        int tIdx = 0;
        for(Double result: results) {
            Double x = Double.valueOf(minibatch[tIdx].getString(xIdx));
            Double y = Double.valueOf(minibatch[tIdx].getString(yIdx));
            w_gradient += x * (y - result);
            b_gradient += (y - result);
            tIdx++;
        }
        w_gradient = (-2.0/n) * Math.round(w_gradient*100.0)/100.0;
        b_gradient = (-2.0/n) * Math.round(b_gradient*100.0)/100.0;
        w_gradient = Math.round(w_gradient*100.0)/100.0;
        b_gradient = Math.round(b_gradient*100.0)/100.0;
    }

    @Override
    public void readjustWeight() {
        w_current = w_current - (learningRate * w_gradient);
        b_current = b_current - (learningRate * b_gradient);
        w_current = Math.round(w_current*100.0)/100.0;
        b_current = Math.round(b_current*100.0)/100.0;

        System.out.println("Learning Rate " + learningRate + ", Current w and b values are : " + w_current + " " + b_current);
    }

//    @Override
//    public void onUpstreamExhausted(LayerTag from) {
//        // System.out.println("----------------------------");
//        double w_gradient = 0;
//        double b_gradient = 0;
//        int batchNum = 0;
//
//        for(Tuple[] batch: super.allBatches()) {
//            double n = batch.length * 1.0;
//            for(Tuple t: batch) {
//                Double x = Double.valueOf(t.getString(xIdx));
//                Double y = Double.valueOf(t.getString(yIdx));
//                w_gradient += x * (y - ((w_current * x) + b_current));
//                b_gradient += (y - ((w_current * x) + b_current));
//            }
//            w_gradient = (-2.0/n) * Math.round(w_gradient*100.0)/100.0;
//            b_gradient = (-2.0/n) * Math.round(b_gradient*100.0)/100.0;
//            w_gradient = Math.round(w_gradient*100.0)/100.0;
//            b_gradient = Math.round(b_gradient*100.0)/100.0;
//
//            w_current = w_current - (learningRate * w_gradient);
//            b_current = b_current - (learningRate * b_gradient);
//
//            w_current = Math.round(w_current*100.0)/100.0;
//            b_current = Math.round(b_current*100.0)/100.0;
//
//            System.out.println("Learning Rate " + learningRate + ", batchNum "+ batchNum +", Current w and b values are : " + w_current + " " + b_current);
//            batchNum++;
//        }
//    }

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
