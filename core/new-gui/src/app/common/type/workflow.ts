import { Breakpoint, OperatorLink, OperatorPredicate, Point } from '../../workspace/types/workflow-common.interface';

/**
 * CachedWorkflow is used to store the information of the workflow
 *  1. all existing operators and their properties
 *  2. operator's position on the JointJS paper
 *  3. operator link predicates
 *
 * When the user refreshes the browser, the CachedWorkflow interface will be
 *  automatically cached and loaded once the refresh completes. This information
 *  will then be used to reload the entire workflow.
 *
 */
export interface WorkflowInfo {
  operators: OperatorPredicate[];
  operatorPositions: { [key: string]: Point };
  links: OperatorLink[];
  breakpoints: Record<string, Breakpoint>;
}

export interface Workflow {
  name: string;
  wid: number;
  content: WorkflowInfo;
  creationTime: number;
  lastModifiedTime: number;
}

export function parseWorkflowInfo(workflow: Workflow) {

    // @ts-ignore
    workflow.content = <WorkflowInfo>JSON.parse(workflow.content);
  return workflow;
}

export interface WorkflowWebResponse extends Readonly<{
  code: 0; // 0 represents success and 1 represents error
  message: string;
  workflow: Workflow;
}> {
}
