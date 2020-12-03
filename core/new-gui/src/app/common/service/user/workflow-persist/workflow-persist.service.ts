import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppSettings } from '../../../app-setting';
import { WorkflowInfo, Workflow } from '../../../type/workflow';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';
import { jsonCast } from '../../../util/storage';

export const WORKFLOW_URL = 'user/dictionary/validate';

@Injectable({
  providedIn: 'root'
})
export class WorkflowPersistService {
  constructor(private http: HttpClient) {
  }

  /**
   * persists a workflow to backend database and returns its updated information (e.g., new wid)
   * @param workflow
   */
  public persistWorkflow(workflow: Workflow): Observable<Workflow> {
    return this.http.post<Workflow>(`${AppSettings.getApiEndpoint()}/workflow/persist`, {
      wid: workflow.wid,
      name: workflow.name,
      content: JSON.stringify(workflow.content)
    }).pipe(map(WorkflowPersistService.parseWorkflowInfo));
  }

  /**
   * retrieves a workflow from backend database given its id. The user in the session must have access to the workflow.
   * @param wid, the workflow id.
   */
  public retrieveWorkflow(wid: number): Observable<Workflow> {
    return this.http.get<Workflow>(`${AppSettings.getApiEndpoint()}/workflow/get/${wid}`)
      .pipe(map(WorkflowPersistService.parseWorkflowInfo));
  }

  /**
   * retrieves a list of workflows from backend database that belongs to the user in the session.
   */
  public retrieveWorkflowsBySessionUser(): Observable<Workflow[]> {
    return this.http.get<Workflow[]>(`${AppSettings.getApiEndpoint()}/workflow/get`)
      .pipe(map((workflows: Workflow[]) => workflows.map(WorkflowPersistService.parseWorkflowInfo)));
  }

  public deleteWorkflow(workflow: Workflow) {
    return null;
  }

  /**
   * helper function to parse WorkflowInfo from a JSON string.
   * @param workflow
   * @private
   */
  private static parseWorkflowInfo(workflow: Workflow): Workflow {
    if (typeof workflow.content === 'string') {
      workflow.content = jsonCast<WorkflowInfo>(workflow.content);
    }
    return workflow;
  }
}
