import { Injectable } from '@angular/core';
import { WorkflowActionService } from '../workflow-graph/model/workflow-action.service';
import { Observable } from '../../../../../node_modules/rxjs';
import { OperatorLink, OperatorPredicate, Point, Breakpoint } from '../../types/workflow-common.interface';
import { OperatorMetadataService } from '../operator-metadata/operator-metadata.service';
import { OperatorInfo, LinkInfo, OperatorGroup, Group } from '../workflow-graph/model/operator-group';

/**
 * SavedWorkflow is used to store the information of the workflow
 *  1. all existing operators and their properties
 *  2. operator's position on the JointJS paper
 *  3. operator link predicates
 *
 * When the user refreshes the browser, the SaveWorkflow interface will be
 *  automatically saved and loaded once the refresh completes. This information
 *  will then be used to reload the entire workflow.
 *
 */
export interface SavedWorkflow {
  operators: OperatorPredicate[];
  operatorPositions: {[key: string]: Point | undefined};
  links: OperatorLink[];
  groups: PlainGroup[];
  breakpoints: Record<string, Breakpoint>;
}

export interface PlainGroup {
  groupID: string;
  operators: Record<string, OperatorInfo>;
  links: Record<string, LinkInfo>;
  inLinks: string[];
  outLinks: string[];
  collapsed: boolean;
}

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

  constructor(
    private workflowActionService: WorkflowActionService,
    private operatorMetadataService: OperatorMetadataService
  ) {
    this.handleAutoSaveWorkFlow();

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

    const savedWorkflow: SavedWorkflow = JSON.parse(savedWorkflowJson);

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

    const breakpoints = new Map(Object.entries(savedWorkflow.breakpoints));

    const groups: readonly Group[] = savedWorkflow.groups.map(group => {
      return {groupID: group.groupID, operators: this.recordToMap(group.operators),
        links: this.recordToMap(group.links), inLinks: group.inLinks, outLinks: group.outLinks,
        collapsed: group.collapsed};
    });

    this.workflowActionService.addOperatorsAndLinks(operatorsAndPositions, links, groups, breakpoints);

    // operators, links, and groups shouldn't be highlighted during page reload
    this.workflowActionService.getJointGraphWrapper().unhighlightElements(
      this.workflowActionService.getJointGraphWrapper().getCurrentHighlights());

    // restore the view point
    this.workflowActionService.getJointGraphWrapper().restoreDefaultZoomAndOffset();
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
      this.workflowActionService.getJointGraphWrapper().getElementPositionChangeEvent(),
      this.workflowActionService.getOperatorGroup().getGroupAddStream(),
      this.workflowActionService.getOperatorGroup().getGroupDeleteStream(),
      this.workflowActionService.getOperatorGroup().getGroupCollapseStream(),
      this.workflowActionService.getOperatorGroup().getGroupExpandStream(),
      this.workflowActionService.getTexeraGraph().getBreakpointChangeStream(),
    ).debounceTime(100).subscribe(() => {
      const workflow = this.workflowActionService.getTexeraGraph();

      const operators = workflow.getAllOperators();
      const links = workflow.getAllLinks();
      const operatorPositions: {[key: string]: Point} = {};
      const breakpointsMap = workflow.getAllLinkBreakpoints();
      const breakpoints: Record<string, Breakpoint> = {};
      breakpointsMap.forEach((value, key) => (breakpoints[key] = value));
      workflow.getAllOperators().forEach(op => operatorPositions[op.operatorID] =
        this.workflowActionService.getOperatorGroup().getOperatorPositionByGroup(op.operatorID));

      const groups = this.workflowActionService.getOperatorGroup().getAllGroups().map(group => {
        return {groupID: group.groupID, operators: this.mapToRecord(group.operators),
          links: this.mapToRecord(group.links), inLinks: group.inLinks, outLinks: group.outLinks,
          collapsed: group.collapsed};
      });

      const savedWorkflow: SavedWorkflow = {
        operators, operatorPositions, links, groups, breakpoints
      };

      localStorage.setItem(SaveWorkflowService.LOCAL_STORAGE_KEY, JSON.stringify(savedWorkflow));
    });
  }

  /**
   * Converts ES6 Map object to TS Record object.
   * This method is used to stringify Map objects.
   * @param map
   */
  private mapToRecord(map: Map<string, any>): Record<string, any> {
    const record: Record<string, any> = {};
    map.forEach((value, key) => record[key] = value);
    return record;
  }

  /**
   * Converts TS Record object to ES6 Map object.
   * This method is used to construct Map objects from JSON.
   * @param record
   */
  private recordToMap(record: Record<string, any>): Map<string, any> {
    const map = new Map<string, any>();
    for (const key of Object.keys(record)) {
      map.set(key, record[key]);
    }
    return map;
  }

}
