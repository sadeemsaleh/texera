import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import { Injectable } from '@angular/core';
import { OperatorMetadataService } from './../operator-metadata/operator-metadata.service';
import { OperatorSchema } from '../../types/operator-schema.interface';
import { WorkflowActionService } from './../workflow-graph/model/workflow-action.service';
import * as Ajv from 'ajv';

export type ValidationError = { isValid: false, messages: Record<string, string> };
export type Validation = { isValid: true } | ValidationError;

/**
 *  ValidationWorkflowService handles the logic to check whether the operator is valid
 *    1. When the user add/delete operators/links
 *    2. When the user complete/delete operator properties
 *    3. When the operator ports are all connected
 *
 *  The operator will become valid if all the ports are connected and its required properties
 *    are completed by the users.
 *
 *  AJV is a javascript library that is used to validate a data object against a structure defined
 *    using a JSON Schema.
 *
 * @author Angela Wang
 */
@Injectable()
export class ValidationWorkflowService {

  public static readonly VALIDATION_OPERATOR_INPUT_MESSAGE = 'inputs';
  public static readonly VALIDATION_OPERATOR_OUTPUT_MESSAGE = 'outputs';

  private operatorSchemaList: ReadonlyArray<OperatorSchema> = [];
  // stream of an individual's validation status is updated, whether it's validation sucess or validation error
  private readonly operatorValidationStream = new Subject<{ operatorID: string, validation: Validation }>();
  // stream of global validation error status is updated, only errors will be reported
  private readonly workflowValidationErrorStream = new Subject<{ errors: Record<string, ValidationError> }>();
  private ajv = new Ajv({ schemaId: 'auto', allErrors: true });

  // this map record --> <operatorID, error string>
  private workflowErrors: Record<string, ValidationError> = {};

  /**
   * subcribe the add opertor event, delete operator event, add link event, delete link event
   * and change operator property event. observe each change and record changes in operatorValidationStream
   * @param texeraGraph
   * @param workflowActionService
   */
  constructor(private operatorMetadataService: OperatorMetadataService,
    private workflowActionService: WorkflowActionService) {


    // fetch operator schema list
    this.operatorMetadataService.getOperatorMetadata()
      .filter(metadata => metadata.operators.length > 0)
      .subscribe(metadata => {
        this.operatorSchemaList = metadata.operators;
        this.initializeValidation();
      });
  }

  /**
   * Gets observable for operatorErrorMap change event
   *
   * map: a Map<operatorID, [operatorType, error_string]
   */
  public getWorkflowValidationErrorStream(): Observable<{ errors: Record<string, ValidationError> }> {
    return this.workflowValidationErrorStream.asObservable();
  }

  /**
   * Gets the observable for operator validation change event.
   * Contains a boolean variable and an operator ID:
   *  - status: the new status for the validation of operator
   *  - operatorID: operator being validated
   */
  public getOperatorValidationStream(): Observable<{ operatorID: string, validation: Validation }> {
    return this.operatorValidationStream.asObservable();
  }


  public validateOperator(operatorID: string): Validation {
    const jsonSchemaValidation = this.validateJsonSchema(operatorID);
    const operatorConnectionValidation = this.validateOperatorConnection(operatorID);
    return ValidationWorkflowService.combineValidation(jsonSchemaValidation, operatorConnectionValidation);
  }

  private updateValidationState(operatorID: string, validation: Validation) {
    this.operatorValidationStream.next({ validation, operatorID });
    if (!validation.isValid) {
      this.workflowErrors[operatorID] = validation;
    } else {
      delete this.workflowErrors[operatorID];
      this.workflowValidationErrorStream.next({ errors: this.workflowErrors });
    }
    this.workflowValidationErrorStream.next({ errors: this.workflowErrors });
  }

  private updateValidationStateOnDelete(operatorID: string) {
    delete this.workflowErrors[operatorID];
    this.workflowValidationErrorStream.next({ errors: this.workflowErrors });
  }

  /**
   * Initialize all the event listener for validation on the workflow editor
   */
  private initializeValidation(): void {
    // when initialized, first validate any initial operators existing in the editor before the event handlers
    //  have been configured. This will happen when the saved workflow reload on the browser
    this.workflowActionService.getTexeraGraph().getAllOperators().forEach(operator => {
      this.updateValidationState(operator.operatorID, this.validateOperator(operator.operatorID));
    });

    // Capture the operator add event and validate the newly added operator
    this.workflowActionService.getTexeraGraph().getOperatorAddStream()
      .subscribe(operator => this.updateValidationState(operator.operatorID, this.validateOperator(operator.operatorID)));

    // Capture the operator delete event but not validate the deleted operator
    this.workflowActionService.getTexeraGraph().getOperatorDeleteStream()
      .subscribe(operator => this.updateValidationStateOnDelete(operator.deletedOperator.operatorID));

    // Capture the link add and delete event and validate the source and target operators for this link
    Observable.merge(
      this.workflowActionService.getTexeraGraph().getLinkAddStream(),
      this.workflowActionService.getTexeraGraph().getLinkDeleteStream().map(link => link.deletedLink)
    ).subscribe(link => {
      this.updateValidationState(link.source.operatorID, this.validateOperator(link.source.operatorID));
      this.updateValidationState(link.target.operatorID, this.validateOperator(link.target.operatorID));
    });

    // Capture the operator property change event and validate the current operator being changed
    this.workflowActionService.getTexeraGraph().getOperatorPropertyChangeStream()
      .subscribe(value => this.updateValidationState(value.operator.operatorID, this.validateOperator(value.operator.operatorID)));
  }

  /**
   * This method is used to check whether all required properties of the operator have been completed.
   *  If completed correctly, the operator is valid.
   */
  private validateJsonSchema(operatorID: string): Validation {
    const operator = this.workflowActionService.getTexeraGraph().getOperator(operatorID);
    if (operator === undefined) {
      throw new Error(`operator with ID ${operatorID} doesn't exist`);
    }
    const operatorSchema = this.operatorSchemaList.find(schema => schema.operatorType === operator.operatorType);
    if (operatorSchema === undefined) {
      throw new Error(`operatorSchema doesn't exist`);
    }

    const isValid = this.ajv.validate(operatorSchema.jsonSchema, operator.operatorProperties);
    if (isValid) {
      return {isValid: true};
    }

    const errors = this.ajv.errors;
    const validationError: Record<string, string> = {};
    if (errors) {
      errors.forEach(error => validationError[error.keyword] = error.message ? error.message : '');
    }
    return { isValid: false, messages: validationError };
  }

  /**
   * This method is used to check whether all ports of the operator have been connected.
   *  if all ports of the operator are connected, the operator is valid.
   */
  private validateOperatorConnection(operatorID: string): Validation {
    const operator = this.workflowActionService.getTexeraGraph().getOperator(operatorID);
    if (operator === undefined) {
      throw new Error(`operator with ID ${operatorID} doesn't exist`);
    }

    const texeraGraph = this.workflowActionService.getTexeraGraph();

    const requiredInputNum = operator.inputPorts.length;
    const requiredOutputNum = operator.outputPorts.length;

    const actualInputNum = texeraGraph.getInputLinksByOperatorId(operatorID).length;
    const actualOutputNum = texeraGraph.getOutputLinksByOperatorId(operatorID).length;

    const satisfyInput = requiredInputNum === actualInputNum;
    const satisyOutput = requiredOutputNum <= actualOutputNum;

    if (satisfyInput && satisyOutput) {
      return { isValid: true };
    } else {
      const messages: Record<string, string> = {};
      if (!satisfyInput) {
        const message = `requires ${requiredInputNum} inputs, has ${actualInputNum} inputs`;
        messages[ValidationWorkflowService.VALIDATION_OPERATOR_INPUT_MESSAGE] = message;
      }
      if (!satisyOutput) {
        const message = `requires ${requiredOutputNum} outputs, has ${actualOutputNum} outputs`;
        messages[ValidationWorkflowService.VALIDATION_OPERATOR_OUTPUT_MESSAGE] = message;
      }
      return { isValid: false, messages: messages };
    }

  }

  public static combineValidation(...validations: Validation[]): Validation {
    let isValid = true;
    let messages = {};
    validations.forEach(validation => {
      isValid = isValid && validation.isValid;
      if (!validation.isValid) {
        messages = { ...messages, ...validation.messages };
      }
    });
    if (isValid) {
      return { isValid };
    } else {
      return { isValid, messages };
    }
  }
}
