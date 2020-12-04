import { Injectable, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppSettings } from '../../../app-setting';
import { WorkflowInfo, Workflow } from '../../../type/workflow';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';
import { jsonCast } from '../../../util/storage';
// import { WorkflowActionService } from 'src/app/workspace/service/workflow-graph/model/workflow-action.service';


export const WORKFLOW_URL = 'user/dictionary/validate';

@Injectable({
  providedIn: 'root'
})

export class WorkflowPersistService {
  constructor(public http: HttpClient
    // private workflowActionService : WorkflowActionService
    ) {
  }

  public persistWorkflow(workflow: Workflow): Observable<Workflow> {
    return this.http.post<Workflow>(`${AppSettings.getApiEndpoint()}/workflow/persist`, {
      wid: workflow.wid,
      name: workflow.name,
      content: JSON.stringify(workflow.content)
    }).pipe(map(WorkflowPersistService.parseWorkflowInfo));
  }

  public retrieveWorkflow(workflowID: string): Observable<Workflow> {
    return this.http.get<Workflow>(`${AppSettings.getApiEndpoint()}/workflow/get/${workflowID}`)
      .pipe(map(WorkflowPersistService.parseWorkflowInfo));
  }

  public retrieveWorkflowsBySessionUser(): Observable<Workflow[]> {
    return this.http.get<Workflow[]>(`${AppSettings.getApiEndpoint()}/workflow/get`)
      .pipe(map((workflows: Workflow[]) => workflows.map(WorkflowPersistService.parseWorkflowInfo)));
  }

  public deleteWorkflow(workflow: Workflow) {
    return null;
  }

  // public handleAutoPersist(){
  //   this.workflowActionService.workflowChange;
  // }

  private static parseWorkflowInfo(workflow: Workflow): Workflow {
    if (workflow!=null){
      if (typeof workflow.content === 'string') {
          workflow.content = jsonCast<WorkflowInfo>(workflow.content);
        }
    }
    return workflow;
  }
}
