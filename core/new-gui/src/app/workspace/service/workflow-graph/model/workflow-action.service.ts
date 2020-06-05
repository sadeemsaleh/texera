import { UndoRedoService } from './../../undo-redo/undo-redo.service';
import { OperatorMetadataService } from './../../operator-metadata/operator-metadata.service';
import { SyncTexeraModel } from './sync-texera-model';
import { JointGraphWrapper } from './joint-graph-wrapper';
import { JointUIService } from './../../joint-ui/joint-ui.service';
import { WorkflowGraph, WorkflowGraphReadonly } from './workflow-graph';
import { Injectable } from '@angular/core';
import { Point, OperatorPredicate, OperatorLink, OperatorPort } from '../../../types/workflow-common.interface';
import { WorkflowCollabService } from './../../workflow-collab/workflow-collab.service';

import * as joint from 'jointjs';
import { environment } from './../../../../../environments/environment';


export interface Command {
  execute(): void;
  undo(): void;
  redo?(): void;
}



// Caveat: These operations must be performed in order, and the ability to sync up multiple clients relies
// on the fact that different clients rest at the same state.

// At least for some of them, have to do a bit more thinking.

export type commandFuncs = 'addOperator' | 'deleteOperator' | 'addOperatorsAndLinks' | 'deleteOperatorsAndLinks'
| 'setOperatorProperty' | 'changeOperatorPosition' | 'setOperatorAdvanceStatus' | 'addLink' | 'deleteLink'
| 'deleteLinkWithID';

// keyof yields permitted property names for T. When we pass function, it'll return value of that function?
// For this type, we index T with the property names for T, which results in us getting the values.
/**
 * type Foo = { a: string, b: number };
 * type ValueOfFoo = ValueOf<Foo>; // string | number
 * ValueOf<Foo> = Foo[a | b] = string | number
 */
type ValueOf<T> = T[keyof T];

// Pick<WorkflowActionService, commandFuncs>: from WorkflowActionService, pick a set of properties whose keys
// are in commandFuncs. commandFuncs are names of functions, so this pick will only allow existing func names.
// So when we make CommandMessage, the function will get inferred from action. Then, it'll require that
// parameters are the parameters for WorkflowActionService[P], or that function.

// P in keyof Pick: P will be one of the properties that exists in there(set of properties from service).
// If we have a name in commandFuncs that doesn't match a property in service, we get error. P picks one of them
export type CommandMessage = ValueOf<{
  [P in keyof Pick<WorkflowActionService, commandFuncs>]:
  {
    action: P;
    parameters: Parameters<WorkflowActionService[P]>;
    type: string;
  }
}>;

type OperatorPosition = {
  position: Point,
  layer: number
};

/**
 *
 * WorkflowActionService exposes functions (actions) to modify the workflow graph model of both JointJS and Texera,
 *  such as addOperator, deleteOperator, addLink, deleteLink, etc.
 * WorkflowActionService performs checks the validity of these actions,
 *  for example, throws an error if deleting an nonexist operator
 *
 * All changes(actions) to the workflow graph should be called through WorkflowActionService,
 *  then WorkflowActionService will propagate these actions to JointModel and Texera Model automatically.
 *
 * For an overview of the services in WorkflowGraphModule, see workflow-graph-design.md
 *
 */

 // New connection gets opened when you subscribe to socket

@Injectable()
export class WorkflowActionService {

  public functionMap: {[key: string]: Function} = {};
  private readonly texeraGraph: WorkflowGraph;
  private readonly jointGraph: joint.dia.Graph;
  private readonly jointGraphWrapper: JointGraphWrapper;
  private readonly syncTexeraModel: SyncTexeraModel;

  constructor(
    private operatorMetadataService: OperatorMetadataService,
    private jointUIService: JointUIService,
    private undoRedoService: UndoRedoService,
    private workflowCollabService: WorkflowCollabService,
  ) {
    this.texeraGraph = new WorkflowGraph();
    this.jointGraph = new joint.dia.Graph();
    this.jointGraphWrapper = new JointGraphWrapper(this.jointGraph, this.undoRedoService);
    this.syncTexeraModel = new SyncTexeraModel(this.texeraGraph, this.jointGraphWrapper);

    this.handleJointLinkAdd();
    this.handleJointOperatorDrag();
    this.handleRemoteChange();

  }

  public toggleSendData(toggle: boolean): void {
    this.workflowCollabService.setSendData(toggle);
  }

  public handleJointLinkAdd(): void {
    this.texeraGraph.getLinkAddStream().filter(() => this.undoRedoService.listenJointCommand).subscribe(link => {
      const command: Command = {
        execute: () => { },
        undo: () => this.deleteLinkWithIDInternal(link.linkID),
        redo: () => this.addLinkInternal(link)
      };
      const commandMessage: CommandMessage = {'action': 'addLink', 'parameters': [link], 'type': 'execute'};
      this.sendCommand(JSON.stringify(commandMessage));
      this.executeAndStoreCommand(command);
    });
  }

  public handleJointOperatorDrag(): void {
    let oldPosition: Point = {x: 0, y: 0};
    let gotOldPosition = false;
    this.jointGraphWrapper.getOperatorPositionChangeEvent()
      .filter(() => !gotOldPosition)
      .filter(() => this.undoRedoService.listenJointCommand)
      .subscribe(event => {
        oldPosition = event.oldPosition;
        gotOldPosition = true;
      });

    this.jointGraphWrapper.getOperatorPositionChangeEvent()
      .filter(() => this.undoRedoService.listenJointCommand)
      .debounceTime(100)
      .subscribe(event => {
        gotOldPosition = false;
        const offsetX = event.newPosition.x - oldPosition.x;
        const offsetY = event.newPosition.y - oldPosition.y;
        // remember currently highlighted operators
        const currentHighlighted = this.jointGraphWrapper.getCurrentHighlightedOperatorIDs();
        const command: Command = {
          execute: () => { },
          undo: () => {
            this.changeOperatorPositionInternal(currentHighlighted, -offsetX, -offsetY);
          },
          redo: () => {
            this.changeOperatorPositionInternal(currentHighlighted, offsetX, offsetY);
          }
        };
        // Send command message here since this is where change first gets detected
        const commandMessage: CommandMessage = {'action': 'changeOperatorPosition',
          'parameters': [currentHighlighted, offsetX, offsetY], 'type': 'execute'};
        this.sendCommand(JSON.stringify(commandMessage));
        this.executeAndStoreCommand(command);
      });
  }


  /**
   * Gets the read-only version of the TexeraGraph
   *  to access the properties and event streams.
   *
   * Texera Graph contains information about the logical workflow plan of Texera,
   *  such as the types and properties of the operators.
   */
  public getTexeraGraph(): WorkflowGraphReadonly {
    return this.texeraGraph;
  }

  /**
   * Gets the JointGraph Wrapper, which contains
   *  getter for properties and event streams as RxJS Observables.
   *
   * JointJS Graph contains information about the UI,
   *  such as the position of operator elements, and the event of user dragging a cell around.
   */
  public getJointGraphWrapper(): JointGraphWrapper {
    return this.jointGraphWrapper;
  }

  /**
   * Let the JointGraph model be attached to the joint paper (paperOptions will be passed to Joint Paper constructor).
   *
   * We don't want to expose JointModel as a public variable, so instead we let JointPaper to pass the constructor options,
   *  and JointModel can be still attached to it without being publicly accessible by other modules.
   *
   * @param paperOptions JointJS paper options
   */
  public attachJointPaper(paperOptions: joint.dia.Paper.Options): joint.dia.Paper.Options {
    paperOptions.model = this.jointGraph;
    return paperOptions;
  }

  /**
   * Adds an opreator to the workflow graph at a point.
   * Throws an Error if the operator ID already existed in the Workflow Graph.
   *
   * @param operator
   * @param point
   */
  public addOperator(operator: OperatorPredicate, point: Point): void {
    // remember currently highlighted operators
    const currentHighlighted = this.jointGraphWrapper.getCurrentHighlightedOperatorIDs();
    const command: Command = {
      execute: () => {
        // turn off multiselect since there's only one operator added
        this.jointGraphWrapper.setMultiSelectMode(false);
        // add operator
        this.addOperatorInternal(operator, point);
        // highlight the newly added operator
        this.jointGraphWrapper.highlightOperator(operator.operatorID);
      },
      undo: () => {
        // remove the operator from JointJS
        this.deleteOperatorInternal(operator.operatorID);
        // restore previous highlights
        this.jointGraphWrapper.unhighlightOperators(this.jointGraphWrapper.getCurrentHighlightedOperatorIDs());
        this.jointGraphWrapper.setMultiSelectMode(currentHighlighted.length > 1);
        this.jointGraphWrapper.highlightOperators(currentHighlighted);
      }
    };
    const commandMessage: CommandMessage = {'action': 'addOperator', 'parameters': [operator, point], 'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  /**
    * Deletes an operator from the workflow graph
    * Throws an Error if the operator ID doesn't exist in the Workflow Graph.
    * @param operatorID
    */
  public deleteOperator(operatorID: string): void {
    const operator = this.getTexeraGraph().getOperator(operatorID);
    const position = this.getJointGraphWrapper().getOperatorPosition(operatorID);
    const layer = this.getJointGraphWrapper().getOperatorLayer(operatorID);
    const linksToDelete = this.getTexeraGraph().getAllLinks()
      .filter(link => link.source.operatorID === operatorID || link.target.operatorID === operatorID);

    const command: Command = {
      execute: () => {
        linksToDelete.forEach(link => this.deleteLinkWithIDInternal(link.linkID));
        this.deleteOperatorInternal(operatorID);
      },
      undo: () => {
        this.addOperatorInternal(operator, position);
        this.getJointGraphWrapper().setOperatorLayer(operatorID, layer);
        linksToDelete.forEach(link => this.addLinkInternal(link));
        // turn off multiselect since only the deleted operator will be added
        this.getJointGraphWrapper().setMultiSelectMode(false);
        this.getJointGraphWrapper().highlightOperator(operator.operatorID);
      }
    };

    const commandMessage: CommandMessage = {'action': 'deleteOperator', 'parameters': [operatorID], 'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  public addOperatorsAndLinks(operatorsAndPositions: {op: OperatorPredicate, pos: Point}[], links: OperatorLink[]): void {
    // remember currently highlighted operators
    const currentHighlighted = this.jointGraphWrapper.getCurrentHighlightedOperatorIDs();

    const command: Command = {
      execute: () => {
        // unhighlight previous highlights
        this.jointGraphWrapper.unhighlightOperators(this.jointGraphWrapper.getCurrentHighlightedOperatorIDs());
        this.jointGraphWrapper.setMultiSelectMode(operatorsAndPositions.length > 1);
        operatorsAndPositions.forEach(o => {
          this.addOperatorInternal(o.op, o.pos);
          this.jointGraphWrapper.highlightOperator(o.op.operatorID);
        });
        links.forEach(l => this.addLinkInternal(l));
      },
      undo: () => {
        // remove links
        links.forEach(l => this.deleteLinkWithIDInternal(l.linkID));
        // remove the operators from JointJS
        operatorsAndPositions.forEach(o => this.deleteOperatorInternal(o.op.operatorID));
        // restore previous highlights
        this.jointGraphWrapper.unhighlightOperators(this.jointGraphWrapper.getCurrentHighlightedOperatorIDs());
        this.jointGraphWrapper.setMultiSelectMode(currentHighlighted.length > 1);
        this.jointGraphWrapper.highlightOperators(currentHighlighted);
      }
    };
    const operators: OperatorPredicate[] = [];
    operatorsAndPositions.forEach(o => {
      operators.push(o.op);
    });

    const commandMessage: CommandMessage = {'action': 'addOperatorsAndLinks', 'parameters': [operatorsAndPositions, links],
    'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  public deleteOperatorsAndLinks(operatorIDs: string[], linkIDs: string[]): void {
    // save operators to be deleted and their current positions
    const operatorsAndPositions = new Map<OperatorPredicate, OperatorPosition>();
    operatorIDs.forEach(operatorID => {
      operatorsAndPositions.set(this.getTexeraGraph().getOperator(operatorID),
        {position: this.getJointGraphWrapper().getOperatorPosition(operatorID),
         layer: this.getJointGraphWrapper().getOperatorLayer(operatorID)});
    });

    // save links to be deleted, including links needs to be deleted and links affected by deleted operators
    const linksToDelete = new Set<OperatorLink>();
    // delete links required by this command
    linkIDs.map(linkID => this.getTexeraGraph().getLinkWithID(linkID))
      .forEach(link => linksToDelete.add(link));
    // delete links related to the deleted operator
    this.getTexeraGraph().getAllLinks()
      .filter(link => operatorIDs.includes(link.source.operatorID) || operatorIDs.includes(link.target.operatorID))
      .forEach(link => linksToDelete.add(link));

    // remember currently highlighted operators
    const currentHighlighted = this.jointGraphWrapper.getCurrentHighlightedOperatorIDs();

    const command: Command = {
      execute: () => {
        linksToDelete.forEach(link => this.deleteLinkWithIDInternal(link.linkID));
        operatorIDs.forEach(operatorID => this.deleteOperatorInternal(operatorID));
      },
      undo: () => {
        operatorsAndPositions.forEach((pos, operator) => {
          this.addOperatorInternal(operator, pos.position);
          this.getJointGraphWrapper().setOperatorLayer(operator.operatorID, pos.layer);
        });
        linksToDelete.forEach(link => this.addLinkInternal(link));
        // restore previous highlights
        this.jointGraphWrapper.unhighlightOperators(this.jointGraphWrapper.getCurrentHighlightedOperatorIDs());
        this.jointGraphWrapper.setMultiSelectMode(currentHighlighted.length > 1);
        this.jointGraphWrapper.highlightOperators(currentHighlighted);
      }
    };

    const commandMessage: CommandMessage = {'action': 'deleteOperatorsAndLinks', 'parameters': [operatorIDs, linkIDs],
  'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));

    this.executeAndStoreCommand(command);
  }

  // not used I believe
  /**
   * Adds a link to the workflow graph
   * Throws an Error if the link ID or the link with same source and target already exists.
   * @param link
   */
  public addLink(link: OperatorLink): void {
    const command: Command = {
      execute: () => this.addLinkInternal(link),
      undo: () => this.deleteLinkWithIDInternal(link.linkID)
    };
    const commandMessage: CommandMessage = {'action': 'addLink', 'parameters': [link], 'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  /**
   * Deletes a link with the linkID from the workflow graph
   * Throws an Error if the linkID doesn't exist in the workflow graph.
   * @param linkID
   */
  public deleteLinkWithID(linkID: string): void {
    const link = this.getTexeraGraph().getLinkWithID(linkID);
    const command: Command = {
      execute: () => this.deleteLinkWithIDInternal(linkID),
      undo: () => this.addLinkInternal(link)
    };
    const commandMessage: CommandMessage = {'action': 'deleteLinkWithID', 'parameters': [linkID], 'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  public deleteLink(source: OperatorPort, target: OperatorPort): void {
    const link = this.getTexeraGraph().getLink(source, target);
    this.deleteLinkWithID(link.linkID);
  }

  // problem here
  public setOperatorProperty(operatorID: string, newProperty: object): void {
    const operator = this.getTexeraGraph().getOperator(operatorID);
    const prevProperty = this.getTexeraGraph().getOperator(operatorID).operatorProperties;
    const command: Command = {
      execute: () => {
        this.jointGraphWrapper.highlightOperator(operatorID);
        this.setOperatorPropertyInternal(operatorID, newProperty);
      },
      undo: () => {
        this.jointGraphWrapper.highlightOperator(operatorID);
        this.setOperatorPropertyInternal(operatorID, prevProperty);
      }
    };
    const commandMessage: CommandMessage = {'action': 'setOperatorProperty', 'parameters': [operatorID, newProperty], 'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  public setOperatorAdvanceStatus(operatorID: string, newShowAdvancedStatus: boolean) {
    const command: Command = {
      execute: () => {
        this.jointGraphWrapper.highlightOperator(operatorID);
        this.setOperatorAdvanceStatusInternal(operatorID, newShowAdvancedStatus);
      },
      undo: () => {
        this.jointGraphWrapper.highlightOperator(operatorID);
        this.setOperatorAdvanceStatusInternal(operatorID, !newShowAdvancedStatus);
      }
    };
    const commandMessage: CommandMessage = {'action': 'setOperatorAdvanceStatus',
      'parameters': [operatorID, newShowAdvancedStatus], 'type': 'execute'};
    this.sendCommand(JSON.stringify(commandMessage));
    this.executeAndStoreCommand(command);
  }

  public changeOperatorPosition(currentHighlighted: string[], offsetX: number, offsetY: number) {
    const command: Command = {
      execute: () => {
        this.changeOperatorPositionInternal(currentHighlighted, offsetX, offsetY);
      },
      undo: () => {
        this.changeOperatorPositionInternal(currentHighlighted, -offsetX, -offsetY);
      }
    };
    this.executeAndStoreCommand(command);
  }

  private addOperatorInternal(operator: OperatorPredicate, point: Point): void {
    // check that the operator doesn't exist
    this.texeraGraph.assertOperatorNotExists(operator.operatorID);
    // check that the operator type exists
    if (! this.operatorMetadataService.operatorTypeExists(operator.operatorType)) {
      throw new Error(`operator type ${operator.operatorType} is invalid`);
    }
    // get the JointJS UI element for operator
    const operatorJointElement = this.jointUIService.getJointOperatorElement(operator, point);

    // add operator to joint graph first
    // if jointJS throws an error, it won't cause the inconsistency in texera graph
    this.jointGraph.addCell(operatorJointElement);

    // if display status feature is enabled, add the execution status tooltip for this operator
    if (environment.executionStatusEnabled) {
      // calculate the position for its popup window
      const tooltipPosition = {x: point.x, y: point.y - 20};
      // get the jointJS UI element for the popup window
      const operatorStatusTooltipJointElement = this.jointUIService.getJointOperatorStatusTooltipElement(operator, tooltipPosition);
      // bind the two elements together
      operatorJointElement.embed(operatorStatusTooltipJointElement);
      // add the status toolip to the JointJS graph
      this.jointGraph.addCell(operatorStatusTooltipJointElement);
    }

    // add operator to texera graph
    this.texeraGraph.addOperator(operator);
  }

  private deleteOperatorInternal(operatorID: string): void {
    this.texeraGraph.assertOperatorExists(operatorID);
    // remove the corresponding tooltip from JointJS first
    if (environment.executionStatusEnabled) {
      this.jointGraph.getCell(JointUIService.getOperatorStatusTooltipElementID(operatorID)).remove();
    }
    // then remove the operator from JointJS
    this.jointGraph.getCell(operatorID).remove();
    // JointJS operator delete event will propagate and trigger Texera operator delete
  }

  private addLinkInternal(link: OperatorLink): void {
    this.texeraGraph.assertLinkNotExists(link);
    this.texeraGraph.assertLinkIsValid(link);
    // add the link to JointJS
    const jointLinkCell = JointUIService.getJointLinkCell(link);
    this.jointGraph.addCell(jointLinkCell);
    // JointJS link add event will propagate and trigger Texera link add
  }

  private deleteLinkWithIDInternal(linkID: string): void {
    this.texeraGraph.assertLinkWithIDExists(linkID);
    this.jointGraph.getCell(linkID).remove();
    // JointJS link delete event will propagate and trigger Texera link delete
  }

  // use this to modify properties
  private setOperatorPropertyInternal(operatorID: string, newProperty: object) {
    this.texeraGraph.setOperatorProperty(operatorID, newProperty);
  }

  private setOperatorAdvanceStatusInternal(operatorID: string, newShowAdvancedStatus: boolean) {
    this.texeraGraph.setOperatorAdvanceStatus(operatorID, newShowAdvancedStatus);
  }

  private changeOperatorPositionInternal(currentHighlighted: string[], offsetX: number, offsetY: number) {
    this.jointGraphWrapper.unhighlightOperators(this.jointGraphWrapper.getCurrentHighlightedOperatorIDs());
    this.jointGraphWrapper.setMultiSelectMode(currentHighlighted.length > 1);
    currentHighlighted.forEach(operatorID => {
      this.jointGraphWrapper.highlightOperator(operatorID);
      this.jointGraphWrapper.setOperatorPosition(operatorID, offsetX, offsetY);
    });
  }

  private executeAndStoreCommand(command: Command): void {
    this.undoRedoService.setListenJointCommand(false);
    command.execute();
    this.undoRedoService.addCommand(command);
    this.undoRedoService.setListenJointCommand(true);
  }

  private sendCommand(update: string): void {
    if (this.workflowCollabService.getSendData()) {
      this.workflowCollabService.sendCommand(update);
    }
  }

  private handleRemoteChange(): void {
    const self = this;
    this.workflowCollabService.getCommandMessageStream().subscribe(message => {
      if (message.type === 'execute') {
        self.toggleSendData(false);
        const func = message.action;
        (this[func] as any).apply(this, message.parameters);
        self.toggleSendData(true);
      }
    });
  }
}
