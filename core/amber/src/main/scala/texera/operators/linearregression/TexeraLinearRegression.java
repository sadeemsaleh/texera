package texera.operators.linearregression;

import Engine.Common.Constants;
import Engine.Operators.KeywordSearch.KeywordSearchMetadata;
import Engine.Operators.LinearRegression.LinearRegressionMetadata;
import Engine.Operators.OperatorMetadata;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import scala.collection.immutable.Set;
import texera.common.TexeraConstraintViolation;
import texera.common.schema.OperatorGroupConstants;
import texera.common.schema.TexeraOperatorDescription;
import texera.common.workflow.TexeraOperator;

public class TexeraLinearRegression extends TexeraOperator {

    @JsonProperty("x attribute")
    @JsonPropertyDescription("column representing x in y=wx+b")
    public String xIdx;

    @JsonProperty("y attribute")
    @JsonPropertyDescription("column representing y in y=wx+b")
    public String yIdx;

    @Override
    public OperatorMetadata amberOperator() {
        return new LinearRegressionMetadata(this.amberOperatorTag(), Constants.defaultNumWorkers(),
                this.context().fieldIndexMapping(this.xIdx.toLowerCase().trim()),
                this.context().fieldIndexMapping(this.yIdx.toLowerCase().trim()));
    }

    @Override
    public Set<TexeraConstraintViolation> validate() {
        scala.collection.mutable.Set<TexeraConstraintViolation> violations =
                new scala.collection.mutable.HashSet<TexeraConstraintViolation>();

        if (this.context().fieldIndexMapping(this.xIdx.toLowerCase()) == null || this.context().fieldIndexMapping(this.yIdx.toLowerCase()) == null ) {
            violations.add(TexeraConstraintViolation.apply(
                    "Either x or y attributes don't exist", "attribute"));
        }
        return violations.toSet();
    }

    @Override
    public TexeraOperatorDescription texeraOperatorDescription() {
        return new TexeraOperatorDescription(
                "Linear Regression",
                "Train a linear regression model",
                OperatorGroupConstants.ANALYTICS_GROUP(),
                1, 1);
    }
}
