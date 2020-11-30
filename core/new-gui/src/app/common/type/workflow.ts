export interface Workflow extends Readonly<{
  name: string;
  wid: number;
  content: string;
  creationTime: number;
  lastModifiedTime: number;
}> {
}


export interface WorkflowWebResponse extends Readonly<{
  code: 0; // 0 represents success and 1 represents error
  message: string;
  workflow: Workflow;
}> {
}
