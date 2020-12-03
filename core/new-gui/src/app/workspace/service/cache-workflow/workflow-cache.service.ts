import { Injectable, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { Breakpoint, OperatorLink, OperatorPredicate, Point } from '../../types/workflow-common.interface';
import { OperatorMetadataService } from '../operator-metadata/operator-metadata.service';
import { WorkflowActionService } from '../workflow-graph/model/workflow-action.service';
import { WorkflowInfo, Workflow } from '../../../common/type/workflow';
import { localGetObject, localSetObject } from '../../../common/util/storage';

/**
 *  CacheWorkflowService is responsible for saving the existing workflow and
 *  reloading back to the JointJS paper when the browser refreshes.
 *
 * It will listens to all the browser action events to update the cached workflow plan.
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
export class WorkflowCacheService {

  private static readonly LOCAL_STORAGE_KEY: string = 'workflow';
  private static readonly DEFAULT_WORKFLOW_NAME: string = 'Untitled Workflow';

  private static readonly DEFAULT_WORKFLOW: Workflow = {
    wid: undefined,
    name: WorkflowCacheService.DEFAULT_WORKFLOW_NAME,
    content: {
      operators: [],
      operatorPositions: {},
      links: [],
      breakpoints: {}
    },
    creationTime: 0,
    lastModifiedTime: 0
  };

  @Output() public cachedWorkflowChanged: Subject<Workflow> = new Subject<Workflow>();

  constructor(
    private workflowActionService: WorkflowActionService,
    private operatorMetadataService: OperatorMetadataService
  ) {

    this.handleAutoCacheWorkFlow();

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
    const workflow: Workflow = this.getCachedWorkflow();
    const workflowInfo: WorkflowInfo = workflow.content;
    const operatorsAndPositions: { op: OperatorPredicate, pos: Point }[] = [];
    workflowInfo.operators.forEach(op => {
      const opPosition = workflowInfo.operatorPositions[op.operatorID];
      if (!opPosition) {
        throw new Error('position error');
      }
      operatorsAndPositions.push({op: op, pos: opPosition});
    });

    const links: OperatorLink[] = [];
    links.push(...workflowInfo.links);

    const breakpoints = new Map(Object.entries(workflowInfo.breakpoints));

    this.workflowActionService.addOperatorsAndLinks(operatorsAndPositions, links, breakpoints);

    // operators shouldn't be highlighted during page reload
    const jointGraphWrapper = this.workflowActionService.getJointGraphWrapper();
    jointGraphWrapper.unhighlightOperators(
      jointGraphWrapper.getCurrentHighlightedOperatorIDs());
    // restore the view point
    this.workflowActionService.getJointGraphWrapper().restoreDefaultZoomAndOffset();
  }

  /**
   * This method will listen to all the workflow change event happening
   *  on the property panel and the workflow editor paper.
   */
  public handleAutoCacheWorkFlow(): void {
    this.workflowActionService.workflowChange.debounceTime(100).subscribe(() => {

      // collect workflow info
      const texeraGraph = this.workflowActionService.getTexeraGraph();
      const operators = texeraGraph.getAllOperators();
      const links = texeraGraph.getAllLinks();
      const operatorPositions: { [key: string]: Point } = {};
      const breakpointsMap = texeraGraph.getAllLinkBreakpoints();
      const breakpoints: Record<string, Breakpoint> = {};
      breakpointsMap.forEach((value, key) => (breakpoints[key] = value));
      texeraGraph.getAllOperators().forEach(op => operatorPositions[op.operatorID] =
        this.workflowActionService.getJointGraphWrapper().getOperatorPosition(op.operatorID));

      // update the cached workflow
      const cachedWorkflow: Workflow = this.getCachedWorkflow();
      cachedWorkflow.content = {
        operators, operatorPositions, links, breakpoints
      };
      this.cacheWorkflow(cachedWorkflow);
    });
  }

  public getCachedWorkflow(): Workflow {
    let workflow = localGetObject<Workflow>(WorkflowCacheService.LOCAL_STORAGE_KEY);
    if (workflow === undefined) {
      this.resetCachedWorkflow();
      workflow = WorkflowCacheService.DEFAULT_WORKFLOW;
    }
    return workflow;
  }

  public resetCachedWorkflow() {
    this.cacheWorkflow(WorkflowCacheService.DEFAULT_WORKFLOW);
  }

  public cacheWorkflow(workflow: Workflow): void {
    localSetObject(WorkflowCacheService.LOCAL_STORAGE_KEY, workflow);
    this.cachedWorkflowChanged.next(workflow);
  }

  public setCachedWorkflowId(wid: number | undefined) {
    const workflow: Workflow = this.getCachedWorkflow();
    workflow.wid = wid;
    this.cacheWorkflow(workflow);
  }

  public setCachedWorkflowName(name: string) {
    const workflow: Workflow = this.getCachedWorkflow();
    workflow.name = name.trim().length > 0 ? name : WorkflowCacheService.DEFAULT_WORKFLOW_NAME;
    this.cacheWorkflow(workflow);
  }

}
