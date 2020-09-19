package Engine.Operators.LinearRegression;

import Engine.Common.AmberTag.LayerTag;
import Engine.Common.AmberTuple.Tuple;
import Engine.Common.TupleProcessor;

import java.util.ArrayList;
import java.util.List;

public class LinearRegressionTupleProcessor implements TupleProcessor {

    private Tuple tuple = null;
    private boolean nextFlag = false;
    private int xIdx = -1;
    private int yIdx = -1;

    private double learningRate = 0.0001;
    private double b_current = 0;
    private double w_current = 0;

    private List<Tuple> allData = new ArrayList<>();

    LinearRegressionTupleProcessor(int xIdx, int yIdx){
        this.xIdx = xIdx;
        this.yIdx = yIdx;
    }

    @Override
    public void accept(Tuple tuple) {
        allData.add(tuple);
    }

    @Override
    public void onUpstreamChanged(LayerTag from) {

    }

    @Override
    public void onUpstreamExhausted(LayerTag from) {
        double w_gradient = 0;
        double b_gradient = 0;
        double n = allData.size() * 1.0;

        for(Tuple t: allData) {
            Double x = Double.valueOf(t.getString(xIdx));
            Double y = Double.valueOf(t.getString(yIdx));
            w_gradient += -(2/n) * x * (y - ((w_current * x) + b_current));
            b_gradient += -(2/n) * (y - ((w_current * x) + b_current));
        }

        w_current = w_current - (learningRate * w_gradient);
        b_current = b_current - (learningRate * b_gradient);

        System.out.println("Current w and b values are : " + w_current + " " + b_current);
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
