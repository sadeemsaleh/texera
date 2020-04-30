import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import { WorkflowUtilService } from '../workflow-graph/util/workflow-util.service';
import { WorkflowActionService } from '../workflow-graph/model/workflow-action.service';
import { Point, OperatorPredicate, OperatorLink, OperatorPort } from '../../types/workflow-common.interface';
import { JointUIService } from '../joint-ui/joint-ui.service';

export interface Group {
  groupID: string;
  operators: Map<string, OperatorInfo>;
  links: Map<string, LinkInfo>;
  inLinks: Map<string, OperatorPort>;
  outLinks: Map<string, OperatorPort>;
  collapsed: boolean;
}

export type OperatorInfo = {
  operator: OperatorPredicate,
  position: Point,
  layer: number
};

export type LinkInfo = {
  link: OperatorLink,
  layer: number
};

export type GroupBoundingBox = {
  topLeft: Point,
  bottomRight: Point
};

type groupSizeType = {
  groupID: string,
  width: number,
  height: number
};

// TO-DO: add undo redo for group add, delete, collapse, and expand

@Injectable()
export class GroupOperatorService {

  private groupIDMap = new Map<string, Group>();
  private listenOperatorPositionChange = true;
  private groupToCollapse: string | undefined;

  private readonly groupAddStream = new Subject<Group>();
  private readonly groupDeleteStream = new Subject<Group>();
  private readonly groupCollapseStream = new Subject<Group>();
  private readonly groupExpandStream = new Subject<Group>();
  private readonly groupResizeStream = new Subject<groupSizeType>();

  constructor(
    private workflowUtilService: WorkflowUtilService,
    private workflowActionService: WorkflowActionService
  ) {
    this.handleTexeraGraphLinkDelete();
    this.handleTexeraGraphLinkAdd();
    this.handleTexeraGraphOperatorDelete();

    this.handleOperatorPositionChange();
    this.handleGroupPositionChange();
    this.handleOperatorLayerChange();
    this.handleLinkLayerChange();
  }

  /**
   * Groups given operators together.
   *
   * If there're less than two operators in the array, or if any one of
   * the operators is already in a group, the action will be ignored.
   *
   * @param operatorIDs
   */
  public groupOperators(operatorIDs: string[]): void {
    if (operatorIDs.length < 2) {
      return;
    }

    for (const operatorID of operatorIDs) {
      if (this.getGroupByOperator(operatorID)) {
        return;
      }
    }

    const group = this.getNewGroup(operatorIDs);
    this.addGroup(group);
  }

  /**
   * Ungroups the given group. If the group is collapsed, it will be
   * expanded before ungrouping.
   *
   * @param groupID
   */
  public ungroupOperators(groupID: string): void {
    const group = this.getGroup(groupID);

    // if the group is collapsed, expand it before ungrouping
    if (group.collapsed) {
      this.expandGroup(groupID);
    }

    this.workflowActionService.deleteGroup(group);
    this.groupIDMap.delete(groupID);
    this.groupDeleteStream.next(group);
  }

  /**
   * Collapses the given group.
   * Throws an error if the group is already collapsed, otherwise hide all
   * operators and links within the group.
   *
   * @param groupID
   */
  public collapseGroup(groupID: string): void {
    const group = this.getGroup(groupID);

    if (group.collapsed) {
      throw Error(`group with ID ${groupID} is already collapsed`);
    }

    // collapse the group on joint graph
    this.workflowActionService.getJointGraphWrapper().setElementSize(groupID, 170, 30);
    // hide embedded operators & links
    this.workflowActionService.getJointGraphWrapper().hideOperatorsAndLinks(group);

    group.collapsed = true;
    this.groupCollapseStream.next(group);
  }

  /**
   * Expands the given group.
   * Throws an error if the group is already expanded, otherwise show all hidden
   * operators and links in the group.
   *
   * @param groupID
   */
  public expandGroup(groupID: string): void {
    const group = this.getGroup(groupID);

    if (!group.collapsed) {
      throw Error(`group with ID ${groupID} is already expanded`);
    }

    // expand the group on joint graph
    this.repositionGroup(group);
    // show embedded operators & links
    this.workflowActionService.getJointGraphWrapper().showOperatorsAndLinks(group);

    group.collapsed = false;
    this.groupExpandStream.next(group);
  }

  /**
   * Adds a new group to the graph.
   * Throws an error the group has a duplicate groupID with an existing group.
   *
   * All cells related to the group (including the group itself) will be moved to the front.
   *
   * @param group
   */
  public addGroup(group: Group): void {
    this.assertGroupNotExists(group.groupID);
    this.assertGroupIsValid(group);

    this.workflowActionService.addGroup(group, this.getGroupBoundingBox(group));
    this.groupIDMap.set(group.groupID, group);
    this.moveGroupToLayer(group, this.getHighestLayer() + 1);

    // collapse the group if it's specified as collapsed
    if (group.collapsed) {
      group.collapsed = false;
      this.collapseGroup(group.groupID);
    }

    this.groupAddStream.next(group);
  }

  /**
   * Gets the group with the groupID.
   * Throws an error if the group doesn't exist.
   *
   * @param groupID
   */
  public getGroup(groupID: string): Group {
    const group = this.groupIDMap.get(groupID);
    if (!group) {
      throw new Error(`group with ID ${groupID} doesn't exist`);
    }
    return group;
  }

  /**
   * Gets the group that the given operator resides in.
   * Returns undefined if there's no such group.
   *
   * @param operatorID
   */
  public getGroupByOperator(operatorID: string): Group | undefined {
    for (const group of this.getAllGroups()) {
      if (group.operators.has(operatorID)) {
        return group;
      }
    }
  }

  /**
   * Gets the group that the given link resides in.
   * Returns undefined if there's no such group.
   *
   * @param linkID
   */
  public getGroupByLink(linkID: string): Group | undefined {
    for (const group of this.getAllGroups()) {
      if (group.links.has(linkID)) {
        return group;
      }
    }
  }

  /**
   * Returns an array of all groups in the graph
   */
  public getAllGroups(): Group[] {
    return Array.from(this.groupIDMap.values());
  }

  /**
   * Gets the event stream of a group being added.
   */
  public getGroupAddStream(): Observable<Group> {
    return this.groupAddStream.asObservable();
  }

  /**
   * Gets the event stream of a group being deleted.
   */
  public getGroupDeleteStream(): Observable<Group> {
    return this.groupDeleteStream.asObservable();
  }

  /**
   * Gets the event stream of a group being collapsed.
   */
  public getGroupCollapseStream(): Observable<Group> {
    return this.groupCollapseStream.asObservable();
  }

  /**
   * Gets the event stream of a group being expanded.
   */
  public getGroupExpandStream(): Observable<Group> {
    return this.groupExpandStream.asObservable();
  }

  /**
   * Gets the event stream of a group being resized.
   */
  public getGroupResizeStream(): Observable<groupSizeType> {
    return this.groupResizeStream.asObservable();
  }

  /**
   * Asserts that the group doesn't exist in the graph.
   * Throws an error if there's a duplicate group ID.
   *
   * @param groupID
   */
  public assertGroupNotExists(groupID: string): void {
    if (this.groupIDMap.has(groupID)) {
      throw new Error(`group with ID ${groupID} already exists`);
    }
  }

  /**
   * Checks if it's valid to add the given group to the graph.
   *
   * Throws an error if it's not a valid group because there are:
   *  - less than two operators in the group
   *  - operators that exist in another group
   *  - links that exist in another group
   *
   * @param group
   */
  public assertGroupIsValid(group: Group): void {
    if (group.operators.size < 2) {
      throw Error(`group has less than two operators`);
    }

    // checks if the group contains operators from another group
    for (const operatorID of Array.from(group.operators.keys())) {
      const duplicateGroup = this.getGroupByOperator(operatorID);
      if (duplicateGroup && duplicateGroup.groupID !== group.groupID) {
        throw Error(`operator ${operatorID} exists in another group`);
      }
    }

    // checks if the group contains links from another group
    for (const linkID of Array.from(group.links.keys())) {
      const duplicateGroup = this.getGroupByLink(linkID);
      if (duplicateGroup && duplicateGroup.groupID !== group.groupID) {
        throw Error(`link ${linkID} exists in another group`);
      }
    }
  }

  /**
   * Gets the given operator's position on the JointJS graph, or its
   * supposed-to-be position if the operator is in a collapsed group.
   *
   * For operators that are supposed to be on the JointJS graph, use
   * getElementPosition() from JointGraphWrapper instead.
   *
   * @param operatorID
   */
  public getOperatorPositionByGroup(operatorID: string): Point {
    const group = this.getGroupByOperator(operatorID);
    if (group && group.collapsed) {
      const operatorInfo = group.operators.get(operatorID);
      if (operatorInfo) {
        return operatorInfo.position;
      } else {
        throw Error(`Internal error: can't find operator ${operatorID} in group ${group.groupID}`);
      }
    } else {
      return this.workflowActionService.getJointGraphWrapper().getElementPosition(operatorID);
    }
  }

  /**
   * Gets the given operator's layer on the JointJS graph, or its
   * supposed-to-be layer if the operator is in a collapsed group.
   *
   * For operators that are supposed to be on the JointJS graph, use
   * getCellLayer() from JointGraphWrapper instead.
   *
   * @param operatorID
   */
  public getOperatorLayerByGroup(operatorID: string): number {
    const group = this.getGroupByOperator(operatorID);
    if (group && group.collapsed) {
      const operatorInfo = group.operators.get(operatorID);
      if (operatorInfo) {
        return operatorInfo.layer;
      } else {
        throw Error(`Internal error: can't find operator ${operatorID} in group ${group.groupID}`);
      }
    } else {
      return this.workflowActionService.getJointGraphWrapper().getCellLayer(operatorID);
    }
  }

  /**
   * Gets the given link's layer on the JointJS graph, or its
   * supposed-to-be layer if the link is in a collapsed group.
   *
   * For links that are supposed to be on the JointJS graph, use
   * getCellLayer() from JointGraphWrapper instead.
   *
   * @param linkID
   */
  public getLinkLayerByGroup(linkID: string): number {
    const group = this.getGroupByLink(linkID);
    if (group && group.collapsed) {
      const linkInfo = group.links.get(linkID);
      if (linkInfo) {
        return linkInfo.layer;
      } else {
        throw Error(`Internal error: can't find link ${linkID} in group ${group.groupID}`);
      }
    } else {
      return this.workflowActionService.getJointGraphWrapper().getCellLayer(linkID);
    }
  }

  /**
   * Creates a new group for given operators.
   *
   * A new group contains the following:
   *  - groupID: the identifier of the group
   *  - operators: a map of all the operators in the group, recording each operator
   *    and their corresponding position and layer
   *  - links: a map of all the links in the group, recording each link and their corresponding layer
   *  - inLinks: a map of all the links whose target operators are in the group,
   *    recording each link's target port
   *  - outLinks: a map of all the links whose source operators are in the group,
   *    recording each link's source port
   *  - collapsed: a boolean value that indicates whether the group is collaped or expanded
   *
   * @param operatorIDs
   */
  private getNewGroup(operatorIDs: string[]): Group {
    const groupID = this.workflowUtilService.getGroupRandomUUID();

    const operators = new Map<string, OperatorInfo>();
    const links = new Map<string, LinkInfo>();
    const inLinks = new Map<string, OperatorPort>();
    const outLinks = new Map<string, OperatorPort>();

    operatorIDs.forEach(operatorID => {
      const operator = this.workflowActionService.getTexeraGraph().getOperator(operatorID);
      const position = this.workflowActionService.getJointGraphWrapper().getElementPosition(operatorID);
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(operatorID);
      operators.set(operatorID, {operator, position, layer});
    });

    this.workflowActionService.getTexeraGraph().getAllLinks().forEach(link => {
      if (operators.has(link.source.operatorID) && operators.has(link.target.operatorID)) {
        const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(link.linkID);
        links.set(link.linkID, {link, layer});
      } else if (!operators.has(link.source.operatorID) && operators.has(link.target.operatorID)) {
        inLinks.set(link.linkID, link.target);
      } else if (operators.has(link.source.operatorID) && !operators.has(link.target.operatorID)) {
        outLinks.set(link.linkID, link.source);
      }
    });

    return {groupID, operators, links, inLinks, outLinks, collapsed: false};
  }

  /**
   * Gets the bounding box of the group.
   *
   * A bounding box contains two points, defining the group's position and size.
   *  - topLeft indicates the position of the operator (if there was one) that's in
   *    the top left corner of the group
   *  - bottomRight indicates the position of the operator (if there was one) that's
   *    in the bottom right corner of the group
   *
   * @param group
   */
  private getGroupBoundingBox(group: Group): GroupBoundingBox {
    const randomOperator = group.operators.get(Array.from(group.operators.keys())[0]);
    if (!randomOperator) {
      throw new Error(`Internal error: group with ID ${group.groupID} is invalid`);
    }

    const topLeft = {x: randomOperator.position.x, y: randomOperator.position.y};
    const bottomRight = {x: randomOperator.position.x, y: randomOperator.position.y};

    group.operators.forEach(operatorInfo => {
      if (operatorInfo.position.x < topLeft.x) {
        topLeft.x = operatorInfo.position.x;
      }
      if (operatorInfo.position.y < topLeft.y) {
        topLeft.y = operatorInfo.position.y;
      }
      if (operatorInfo.position.x > bottomRight.x) {
        bottomRight.x = operatorInfo.position.x;
      }
      if (operatorInfo.position.y > bottomRight.y) {
        bottomRight.y = operatorInfo.position.y;
      }
    });

    return {topLeft, bottomRight};
  }

  /**
   * Gets the layer of the frontmost cell in the graph.
   */
  private getHighestLayer(): number {
    let highestLayer = 0;

    this.workflowActionService.getTexeraGraph().getAllOperators().forEach(operator => {
      const layer = this.getOperatorLayerByGroup(operator.operatorID);
      if (layer > highestLayer) {
        highestLayer = layer;
      }
    });
    this.workflowActionService.getTexeraGraph().getAllLinks().forEach(link => {
      const layer = this.getLinkLayerByGroup(link.linkID);
      if (layer > highestLayer) {
        highestLayer = layer;
      }
    });

    return highestLayer;
  }

  /**
   * Moves the given group to the given layer. All related cells (embedded operators,
   * links, inLinks, and outLinks) will be moved to corresponding new layers:
   *    own layer + group's new layer
   *
   * @param group
   * @param groupLayer
   */
  private moveGroupToLayer(group: Group, groupLayer: number): void {
    group.operators.forEach((operatorInfo, operatorID) => {
      this.workflowActionService.getJointGraphWrapper().setCellLayer(operatorID, operatorInfo.layer + groupLayer);
    });
    group.links.forEach((linkInfo, linkID) => {
      this.workflowActionService.getJointGraphWrapper().setCellLayer(linkID, linkInfo.layer + groupLayer);
    });
    group.inLinks.forEach((port, linkID) => {
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(linkID);
      this.workflowActionService.getJointGraphWrapper().setCellLayer(linkID, layer + groupLayer);
    });
    group.outLinks.forEach((port, linkID) => {
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(linkID);
      this.workflowActionService.getJointGraphWrapper().setCellLayer(linkID, layer + groupLayer);
    });
    this.workflowActionService.getJointGraphWrapper().setCellLayer(group.groupID, groupLayer);
  }

  /**
   * Repositions and resizes the given group to fit its embedded operators.
   * @param group
   */
  private repositionGroup(group: Group): void {
    const {topLeft, bottomRight} = this.getGroupBoundingBox(group);

    // calculates group's new position
    const originalPosition = this.workflowActionService.getJointGraphWrapper().getElementPosition(group.groupID);
    const offsetX = topLeft.x - JointUIService.DEFAULT_GROUP_MARGIN - originalPosition.x;
    const offsetY = topLeft.y - JointUIService.DEFAULT_GROUP_MARGIN - originalPosition.y;

    // calculates group's new height & width
    const width = bottomRight.x - topLeft.x + JointUIService.DEFAULT_OPERATOR_WIDTH + 2 * JointUIService.DEFAULT_GROUP_MARGIN;
    const height = bottomRight.y - topLeft.y + JointUIService.DEFAULT_OPERATOR_HEIGHT + 2 * JointUIService.DEFAULT_GROUP_MARGIN;

    // reposition the group and embedded operators to offset the side effect of embedding + repositioning
    this.listenOperatorPositionChange = false;
    this.workflowActionService.getJointGraphWrapper().setElementPosition(group.groupID, offsetX, offsetY);
    if (!group.collapsed) {
      group.operators.forEach((operatorInfo, operatorID) => {
        this.workflowActionService.getJointGraphWrapper().setElementPosition(operatorID, -offsetX, -offsetY);
      });
    }
    this.listenOperatorPositionChange = true;

    // resize the group according to the new size
    this.workflowActionService.getJointGraphWrapper().setElementSize(group.groupID, width, height);
    this.groupResizeStream.next({groupID: group.groupID, height: height, width: width});
  }

  // TO-DO: handle texera graph operator add
  //  - when an operator is added, check if the operator's top left point
  //    and bottom right point are within any group on the graph
  //  - if it does, add the operator to the group

  /**
   * Handles operator delete events on texera graph.
   * If the deleted operator is embedded in some group,
   *  1) remove the operator from the group
   *  2) delete the group if there're less than two operators left
   *  3) reposition the group to fit remaining operators otherwise
   */
  private handleTexeraGraphOperatorDelete(): void {
    this.workflowActionService.getTexeraGraph().getOperatorDeleteStream()
      .map(operator => operator.deletedOperator)
      .subscribe(deletedOperator => {
        this.groupIDMap.forEach(group => {
          if (group.operators.has(deletedOperator.operatorID)) {
            group.operators.delete(deletedOperator.operatorID);
            if (group.operators.size < 2) {
              this.ungroupOperators(group.groupID);
            } else {
              this.repositionGroup(group);
            }
          }
        });
      });
  }

  // TO-DO: handle in-link & out-link add events that happened when group is collapsed
  //  * possible when an in-link/out-link is deleted when the group is collapsed, then user undo this action *
  // Solution: 1. add an event stream before the link is added (possibly in workflowActionService)
  //           2. subscribe to the event stream & check if the link's source/target operator is in a collapsed group
  //              using getGroupByOperator
  //           3. if it's an in-link or out-link (or both), expand the corresponding group(s)
  //    (done) 4. save the groupID somewhere
  //    (done) 5. in handleTexeraGraphLinkAdd(), collapse the group and set the variable to undefined

  /**
   * Handles link add events on texera graph.
   * Checks if the added link is related to some group, and add the
   * link to the group as a link, inLink, or outLink.
   */
  private handleTexeraGraphLinkAdd(): void {
    this.workflowActionService.getTexeraGraph().getLinkAddStream().subscribe(link => {
      this.groupIDMap.forEach(group => {
        if (group.operators.has(link.source.operatorID) && group.operators.has(link.target.operatorID)) {
          const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(link.linkID);
          group.links.set(link.linkID, {link, layer});
        } else if (!group.operators.has(link.source.operatorID) && group.operators.has(link.target.operatorID)) {
          group.inLinks.set(link.linkID, link.target);
        } else if (group.operators.has(link.source.operatorID) && !group.operators.has(link.target.operatorID)) {
          group.outLinks.set(link.linkID, link.source);
        }
      });
      if (this.groupToCollapse) {
        this.collapseGroup(this.groupToCollapse);
        this.groupToCollapse = undefined;
      }
    });
  }

  /**
   * Handles link delete events on texera graph.
   * If the deleted link is related to some group, remove it from the group.
   */
  private handleTexeraGraphLinkDelete(): void {
    this.workflowActionService.getTexeraGraph().getLinkDeleteStream()
      .map(link => link.deletedLink)
      .subscribe(deletedLink => {
        this.groupIDMap.forEach(group => {
          if (group.links.has(deletedLink.linkID)) {
            group.links.delete(deletedLink.linkID);
          } else if (group.inLinks.has(deletedLink.linkID)) {
            group.inLinks.delete(deletedLink.linkID);
          } else if (group.outLinks.has(deletedLink.linkID)) {
            group.outLinks.delete(deletedLink.linkID);
          }
        });
      });
  }

  /**
   * Handles operator position change events.
   * If the moved operator is embedded in some group,
   *  1) update the operator's position stored in the group
   *  2) reposition the group to fit the moved operator
   */
  private handleOperatorPositionChange(): void {
    this.workflowActionService.getJointGraphWrapper().getElementPositionChangeEvent()
      .filter(() => this.listenOperatorPositionChange)
      .filter(movedElement => this.workflowActionService.getTexeraGraph().hasOperator(movedElement.elementID))
      .subscribe(movedOperator => {
        this.groupIDMap.forEach(group => {
          const operatorInfo = group.operators.get(movedOperator.elementID);
          if (operatorInfo) {
            operatorInfo.position = movedOperator.newPosition;
            this.repositionGroup(group);
          }
        });
      });
  }

  /**
   * Handles group position change events.
   * If the group is collapsed when it's moved, update its embedded operators'
   * position according to the relative offset, so that operators are in the
   * right position when the moved group is expanded.
   */
  private handleGroupPositionChange(): void {
    this.workflowActionService.getJointGraphWrapper().getElementPositionChangeEvent()
      .filter(movedElement => this.groupIDMap.has(movedElement.elementID))
      .subscribe(movedGroup => {
        const group = this.getGroup(movedGroup.elementID);
        if (group.collapsed) {
          const offsetX = movedGroup.newPosition.x - movedGroup.oldPosition.x;
          const offsetY = movedGroup.newPosition.y - movedGroup.oldPosition.y;
          group.operators.forEach(operatorInfo => {
            operatorInfo.position = {x: operatorInfo.position.x + offsetX, y: operatorInfo.position.y + offsetY};
          });
        }
      });
  }

  /**
   * Handles operator layer change events.
   * If the operator is embedded in some group, update its layer stored in the group.
   */
  private handleOperatorLayerChange(): void {
    this.workflowActionService.getJointGraphWrapper().getCellLayerChangeEvent()
      .filter(movedOperator => this.workflowActionService.getTexeraGraph().hasOperator(movedOperator.cellID))
      .subscribe(movedOperator => {
        this.groupIDMap.forEach(group => {
          const operatorInfo = group.operators.get(movedOperator.cellID);
          if (operatorInfo) {
            operatorInfo.layer = movedOperator.newLayer;
          }
        });
      });
  }

  /**
   * Handles link layer change events.
   * If the link is embedded in some group, update its layer stored in the group.
   */
  private handleLinkLayerChange(): void {
    this.workflowActionService.getJointGraphWrapper().getCellLayerChangeEvent()
      .filter(movedLink => this.workflowActionService.getTexeraGraph().hasLinkWithID(movedLink.cellID))
      .subscribe(movedLink => {
        this.groupIDMap.forEach(group => {
          const linkInfo = group.links.get(movedLink.cellID);
          if (linkInfo) {
            linkInfo.layer = movedLink.newLayer;
          }
        });
      });
  }

}
