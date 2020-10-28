package edu.uci.ics.texera.workflow.operators.pythonUDFV2;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import edu.uci.ics.amber.engine.operators.OpExecConfig;
import edu.uci.ics.texera.workflow.common.metadata.OperatorGroupConstants;
import edu.uci.ics.texera.workflow.common.metadata.OperatorInfo;
import edu.uci.ics.texera.workflow.common.operators.OneToOneOpExecConfig;
import edu.uci.ics.texera.workflow.common.operators.OperatorDescriptor;
import edu.uci.ics.texera.workflow.common.tuple.schema.Attribute;
import edu.uci.ics.texera.workflow.common.tuple.schema.Schema;

import java.util.List;


public class PythonUDFOpDescV2 extends OperatorDescriptor {

    @JsonProperty("Python script")
    @JsonPropertyDescription("input your code here")
    public String pythonScriptText;

    @JsonProperty("Python script file")
    @JsonPropertyDescription("name of the UDF script file")
    public String pythonScriptFile;

    @JsonProperty("Arguments")
    @JsonPropertyDescription("user provided arguments as a string")
    public String arguments;

    @JsonProperty(value = "batch size", required = true, defaultValue = "100")
    @JsonPropertyDescription("size of every batch of tuples to pass to python")
    public int batchSize;

    @Override
    public OpExecConfig operatorExecutor() {
        return new OneToOneOpExecConfig(this.operatorIdentifier(), worker -> new PythonUDFOpExecV2(
                this.pythonScriptText, this.pythonScriptFile, this.arguments, this.batchSize));
    }

    @Override
    public OperatorInfo operatorInfo() {
        return new OperatorInfo(
                "Python UDF",
                "User-defined function operator in Python script",
                OperatorGroupConstants.UDF_GROUP(),
                1, 1);
    }

    @Override
    public Schema getOutputSchema(Schema[] schemas) {
        return null;
    }

}
