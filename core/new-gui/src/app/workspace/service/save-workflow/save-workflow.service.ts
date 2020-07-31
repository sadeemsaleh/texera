import { Injectable } from '@angular/core';
import { WorkflowActionService } from '../workflow-graph/model/workflow-action.service';
import { Observable } from '../../../../../node_modules/rxjs';
import { OperatorLink, OperatorPredicate, Point } from '../../types/workflow-common.interface';
import { OperatorMetadataService } from '../operator-metadata/operator-metadata.service';
import { HttpClient } from '@angular/common/http';
import { AppSettings } from 'src/app/common/app-setting';

/**
 * SavedWorkflow is used to store the information of the workflow
 * 1. its ID
 * 2. its name
 * 3. its body which is SavedWorkflowBody
 */
export interface SavedWorkflow {
  workflowID: string;
  workflowName: string;
  workflowBody: SavedWorkflowBody;
}

/**
 * SavedWorkflowBody is used to store the information of the workflow
 *  1. all existing operators and their properties
 *  2. operator's position on the JointJS paper
 *  3. operator link predicates
 *
 * When the user refreshes the browser, the SaveWorkflow interface will be
 *  automatically saved and loaded once the refresh completes. This information
 *  will then be used to reload the entire workflow.
 *
 */

export interface SavedWorkflowBody {
  operators: OperatorPredicate[];
  operatorPositions: {[key: string]: Point | undefined};
  links: OperatorLink[];
}

export interface SuccessSaveResponse {
  code: 0;
  message: String;
}

export const FETCH_WORKFLOW_ENDPOINT = 'workflow/get';
export const SAVE_WORKFLOW_ENDPOINT = 'workflow/update-workflow';

/**
 * SaveWorkflowService is responsible for saving the existing workflow and
 *  reloading back to the JointJS paper when the browser refreshes.
 *
 * It will listens to all the browser action events to update the saved workflow plan.
 * These actions include:
 *  1. operator add
 *  2. operator delete
 *  3. link add
 *  4. link delete
 *  5. operator property change
 *  6. operator position change
 *
 * @author Simon Zhou
 */
@Injectable({
  providedIn: 'root'
})
export class SaveWorkflowService {

  private static readonly LOCAL_STORAGE_KEY: string = 'workflow';
  private static readonly SESSION_STORAGE_KEY_WORKFLOW: string = 'workflow';
  private static readonly Session_STORAGE_KEY_HIGHLIGHTED: string = 'highlighted';

  constructor(
    private workflowActionService: WorkflowActionService,
    private operatorMetadataService: OperatorMetadataService,
    private httpClient: HttpClient
  ) {
    this.handleAutoSaveWorkFlow();

    // commented out because fetchWorfklow will be called
    this.operatorMetadataService.getOperatorMetadata()
      .filter(metadata => metadata.operators.length !== 0)
      .subscribe(() => this.loadWorkflow());
  }

  /**
   * When the browser reloads, this method will be called to reload
   *  previously created workflow stored in the local storage onto
   *  the JointJS paper.
   */
  public loadWorkflow(): void {
    // remove the existing operators on the paper currently
    this.workflowActionService.deleteOperatorsAndLinks(
      this.workflowActionService.getTexeraGraph().getAllOperators().map(op => op.operatorID), []);

    // get items in the storage
    const savedWorkflowJson = localStorage.getItem(SaveWorkflowService.LOCAL_STORAGE_KEY);
    if (! savedWorkflowJson) {
      return;
    }

    const savedWorkflow: SavedWorkflowBody = JSON.parse(savedWorkflowJson);

    const operatorsAndPositions: {op: OperatorPredicate, pos: Point}[] = [];
    savedWorkflow.operators.forEach(op => {
      const opPosition = savedWorkflow.operatorPositions[op.operatorID];
      if (! opPosition) {
        throw new Error('position error');
      }
      operatorsAndPositions.push({op: op, pos: opPosition});
    });

    const links: OperatorLink[] = [];
    savedWorkflow.links.forEach(link => {
      links.push(link);
    });

    this.workflowActionService.addOperatorsAndLinks(operatorsAndPositions, links);

    // operators shouldn't be highlighted during page reload
    this.workflowActionService.getJointGraphWrapper().unhighlightOperators(
      this.workflowActionService.getJointGraphWrapper().getCurrentHighlightedOperatorIDs());
  }

  /**
   * this method send an request to the backend to get
   *  the workflow of a specific id stored in the backend mysql storage
   *  and display it onto the JointJS paper.
   *
   * this method is called when user type in url like localhost:4200/workflow/id-1234
   * the function call argument in this case will be id-1234
   */
  public fetchWorkflow(workflowID: String): void {
    // wait until the frontend receives operatormetadata because otherwise workflow cannot be created
    this.operatorMetadataService.getOperatorMetadata()
      .filter(metadata => metadata.operators.length !== 0)
      .subscribe(() => {
        this.httpClient.get<SavedWorkflow>(`${AppSettings.getApiEndpoint()}/${FETCH_WORKFLOW_ENDPOINT}/${workflowID}`)
          .subscribe(workflow => {
            // set current workflow's id
            this.workflowActionService.getTexeraGraph().setID(workflow.workflowID);
            const workflowBody = workflow.workflowBody as SavedWorkflowBody;
            const savedWorkflowJson = sessionStorage.getItem(SaveWorkflowService.SESSION_STORAGE_KEY_WORKFLOW);
            if (JSON.stringify(workflowBody) === savedWorkflowJson) {
              // do not refresh the page
              return;
            }

            this.workflowActionService.deleteOperatorsAndLinks(
              this.workflowActionService.getTexeraGraph().getAllOperators().map(op => op.operatorID), []);

            const operatorsAndPositions: {op: OperatorPredicate, pos: Point}[] = [];
            workflowBody.operators.forEach(op => {
              const opPosition = workflowBody.operatorPositions[op.operatorID];
              if (! opPosition) {
                throw new Error('position error');
              }
              operatorsAndPositions.push({op: op, pos: opPosition});
            });

            const links: OperatorLink[] = [];
            workflowBody.links.forEach(link => {
              links.push(link);
            });

            this.workflowActionService.addOperatorsAndLinks(operatorsAndPositions, links);

            // operators shouldn't be highlighted during workflow fetching
            this.workflowActionService.getJointGraphWrapper().unhighlightOperators(
              this.workflowActionService.getJointGraphWrapper().getCurrentHighlightedOperatorIDs());

            const highlightedOperatorIDsJSON = sessionStorage.getItem(SaveWorkflowService.SESSION_STORAGE_KEY_WORKFLOW);
            if (highlightedOperatorIDsJSON) {
              const sessionStoredHighlightedOperatorIDs: string[] = JSON.parse(highlightedOperatorIDsJSON);
              this.workflowActionService.getJointGraphWrapper().highlightOperators(sessionStoredHighlightedOperatorIDs);
            }
          });
      });
  }

  /**
   * This method will listen to all the workflow change event happening
   *  on the property panel and the worfklow editor paper.
   */
  public handleAutoSaveWorkFlow(): void {
    Observable.merge(
      this.workflowActionService.getTexeraGraph().getOperatorAddStream(),
      this.workflowActionService.getTexeraGraph().getOperatorDeleteStream(),
      this.workflowActionService.getTexeraGraph().getLinkAddStream(),
      this.workflowActionService.getTexeraGraph().getLinkDeleteStream(),
      this.workflowActionService.getTexeraGraph().getOperatorPropertyChangeStream(),
      this.workflowActionService.getTexeraGraph().getOperatorAdvancedOptionChangeSteam(),
      this.workflowActionService.getJointGraphWrapper().getOperatorPositionChangeEvent()
    ).debounceTime(100).subscribe(() => {
      const workflow = this.workflowActionService.getTexeraGraph();

      const operators = workflow.getAllOperators();
      const links = workflow.getAllLinks();
      const operatorPositions: {[key: string]: Point} = {};
      workflow.getAllOperators().forEach(op => operatorPositions[op.operatorID] =
        this.workflowActionService.getJointGraphWrapper().getOperatorPosition(op.operatorID));

      const savedWorkflow: SavedWorkflowBody = {
        operators, operatorPositions, links
      };

      localStorage.setItem(SaveWorkflowService.LOCAL_STORAGE_KEY, JSON.stringify(savedWorkflow));
      // session storeage are not shared across browser tabs,
      // used to determine, after a workflow fetch request, if should refresh the page (is there diff?)
      sessionStorage.setItem(SaveWorkflowService.SESSION_STORAGE_KEY_WORKFLOW, JSON.stringify(savedWorkflow));
      sessionStorage.setItem(SaveWorkflowService.Session_STORAGE_KEY_HIGHLIGHTED,
        JSON.stringify(this.workflowActionService.getJointGraphWrapper().getCurrentHighlightedOperatorIDs()));
      // after saving the workflow locally at frontend, send an request to save it in the backend
      const saveWorkflowRequestURL = `${AppSettings.getApiEndpoint()}/${SAVE_WORKFLOW_ENDPOINT}`;
      const formData: FormData = new FormData();
      // formData.append('workflowID', 'tobacco-analysis-workflow');
      formData.append('workflowID', workflow.getID());
      formData.append('workflowBody', JSON.stringify(savedWorkflow));

      this.httpClient.post<SuccessSaveResponse>(
        saveWorkflowRequestURL,
        formData)
        .subscribe(
          response => {
            // do something with response
          },
          errorResponse => {
            // do something with error
          }
      );
    });
  }




}
