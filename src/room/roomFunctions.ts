import { allyList, constants, prefferedCommuneRange, stamps } from 'international/constants'
import {
     advancedFindDistance,
     arePositionsEqual,
     customLog,
     findClosestClaimType,
     findClosestCommuneName,
     findPositionsInsideRect,
     getRange,
     getRangeBetween,
     pack,
     unpackAsPos,
     unpackAsRoomPos,
} from 'international/generalFunctions'
import { basePlanner } from './construction/basePlanner'
import { ControllerUpgrader, MineralHarvester, SourceHarvester } from './creeps/creepClasses'
import { RoomObject } from './roomObject'
import { RoomTask } from './roomTasks'

Room.prototype.get = function (roomObjectName) {
     const room = this

     // Cost matrixes

     function generateTerrainCM() {
          const terrain = room.getTerrain()

          // Create a CostMatrix for terrain types

          const terrainCM = new PathFinder.CostMatrix()

          // Loop through each x and y in the room

          for (let x = 0; x < constants.roomDimensions; x += 1) {
               for (let y = 0; y < constants.roomDimensions; y += 1) {
                    // Try to find the terrainValue

                    const terrainValue = terrain.get(x, y)

                    // If terrain is a wall

                    if (terrainValue === TERRAIN_MASK_WALL) {
                         // Set this positions as 1 in the terrainCM

                         terrainCM.set(x, y, 255)
                    }
               }
          }

          return terrainCM
     }

     new RoomObject({
          name: 'terrainCM',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: generateTerrainCM,
     })

     function generateBaseCM() {
          // Construct a cost matrix based off terrain cost matrix

          const baseCM = room.roomObjects.terrainCM.getValue().clone()

          // Get the room's exits

          const exits = room.find(FIND_EXIT)

          // Loop through each exit of exits

          for (const pos of exits) {
               // Record the exit as a pos to avoid

               baseCM.set(pos.x, pos.y, 255)

               // Construct a rect and get the positions in a range of 2

               const adjacentPositions = findPositionsInsideRect(pos.x - 2, pos.y - 2, pos.x + 2, pos.y + 2)

               // Loop through adjacent positions

               for (const adjacentPos of adjacentPositions) {
                    // Otherwise record the position as a wall

                    baseCM.set(adjacentPos.x, adjacentPos.y, 255)
               }
          }

          // Inform the baseCM

          return baseCM
     }

     new RoomObject({
          name: 'baseCM',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: generateBaseCM,
     })

     // roadCM

     new RoomObject({
          name: 'roadCM',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: () => {
               return new PathFinder.CostMatrix()
          },
     })

     // Resources

     // Mineral

     new RoomObject({
          name: 'mineral',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return room.find(FIND_MINERALS)[0]?.id
          },
     })

     // Source 1

     new RoomObject({
          name: 'source1',
          valueType: 'id',
          cacheType: 'memory',
          room,
          valueConstructor() {
               // Get the first source

               const source = room.find(FIND_SOURCES)[0]

               // If the source exists, inform its id. Otherwise inform false

               if (source) return source.id
               return false
          },
     })

     // Source 2

     new RoomObject({
          name: 'source2',
          valueType: 'id',
          cacheType: 'memory',
          room,
          valueConstructor() {
               // Get the second source

               const source = room.find(FIND_SOURCES)[1]

               // If the source exists, inform its id. Otherwise inform false

               if (source) return source.id
               return false
          },
     })

     // Sources

     new RoomObject({
          name: 'sources',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               const sources = [room.roomObjects.source1.getValue()]
               const source2 = room.roomObjects.source2.getValue()

               if (source2) sources.push(source2)

               return sources
          },
     })

     // Structures and cSites

     function findStructuresByType() {
          // Construct storage of structures based on structureType

          const structuresByType: Partial<Record<StructureConstant, Structure[]>> = {}

          // Loop through all structres in room

          for (const structure of room.find(FIND_STRUCTURES)) {
               // If there is no key for the structureType, create it and assign it an empty array

               if (!structuresByType[structure.structureType]) structuresByType[structure.structureType] = []

               // Group structure by structureType

               structuresByType[structure.structureType].push(structure)
          }

          // Inform structuresByType

          return structuresByType
     }

     new RoomObject({
          name: 'structuresByType',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findStructuresByType,
     })

     function findCSitesByType() {
          // Construct storage of cSites based on structureType

          const cSitesByType: Partial<Record<StructureConstant, ConstructionSite[]>> = {}

          // Loop through all structres in room

          for (const cSite of room.find(FIND_MY_CONSTRUCTION_SITES)) {
               // If there is no key for the structureType, create it and assign it an empty array

               if (!cSitesByType[cSite.structureType]) cSitesByType[cSite.structureType] = []

               // Group cSite by structureType

               cSitesByType[cSite.structureType].push(cSite)
          }

          // Inform structuresByType

          return cSitesByType
     }

     new RoomObject({
          name: 'cSitesByType',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findCSitesByType,
     })

     // Loop through each structureType in the game

     for (const structureType of constants.allStructureTypes) {
          // Create roomObject for structures with the structureType

          new RoomObject({
               name: structureType,
               valueType: 'object',
               cacheType: 'global',
               cacheAmount: 1,
               room,
               valueConstructor() {
                    return room.roomObjects.structuresByType.getValue()[structureType] || []
               },
          })

          // Create a roomObject for sites with the structureType

          new RoomObject({
               name: `${structureType}CSite`,
               valueType: 'object',
               cacheType: 'global',
               cacheAmount: 1,
               room,
               valueConstructor() {
                    return room.roomObjects.cSitesByType.getValue()[structureType] || []
               },
          })
     }

     new RoomObject({
          name: 'enemyCSites',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor() {
               // Inform constuction sites that aren't owned by a member of the allyList

               return room.find(FIND_HOSTILE_CONSTRUCTION_SITES, {
                    filter: cSite => !allyList.has(cSite.owner.username),
               })
          },
     })

     new RoomObject({
          name: 'allyCSites',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor() {
               // Inform constuction sites that aren't owned by a member of the allyList

               return room.find(FIND_HOSTILE_CONSTRUCTION_SITES, {
                    filter: cSite => allyList.has(cSite.owner.username),
               })
          },
     })

     // Harvest positions

     /**
      * Finds positions adjacent to a source that a creep can harvest
      * @param source source of which to find harvestPositions for
      * @returns source's harvestPositions, a list of positions
      */
     function findHarvestPositions(source: Source | Mineral) {
          // Stop and inform empty array if there is no source

          if (!source) return []

          // Construct harvestPositions

          const harvestPositions = []

          // Find terrain in room

          const terrain = Game.map.getRoomTerrain(room.name)

          // Find positions adjacent to source

          const adjacentPositions = findPositionsInsideRect(
               source.pos.x - 1,
               source.pos.y - 1,
               source.pos.x + 1,
               source.pos.y + 1,
          )

          // Loop through each pos

          for (const pos of adjacentPositions) {
               // Iterate if terrain for pos is a wall

               if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue

               // Add pos to harvestPositions

               harvestPositions.push(room.newPos(pos))
          }

          // Inform harvestPositions

          return harvestPositions
     }

     /**
      * @param harvestPositions array of RoomPositions to filter
      * @returns the closest harvestPosition to the room's anchor
      */
     function findClosestHarvestPos(harvestPositions: RoomPosition[]): void | RoomPosition {
          // Get the room anchor, stopping if it's undefined

          if (!room.anchor) return

          // Filter harvestPositions by closest one to anchor

          return room.anchor.findClosestByPath(harvestPositions, {
               ignoreCreeps: true,
               ignoreDestructibleStructures: true,
               ignoreRoads: true,
          })
     }

     new RoomObject({
          name: 'mineralHarvestPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findHarvestPositions(room.roomObjects.mineral.getValue())
          },
     })

     new RoomObject({
          name: 'closestMineralHarvestPos',
          valueType: 'pos',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findClosestHarvestPos(room.roomObjects.mineralHarvestPositions.getValue())
          },
     })

     new RoomObject({
          name: 'source1HarvestPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findHarvestPositions(room.roomObjects.source1.getValue())
          },
     })

     new RoomObject({
          name: 'source1ClosestHarvestPos',
          valueType: 'pos',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findClosestHarvestPos(room.roomObjects.source1HarvestPositions.getValue())
          },
     })

     new RoomObject({
          name: 'source2HarvestPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findHarvestPositions(room.roomObjects.source2.getValue())
          },
     })

     new RoomObject({
          name: 'source2ClosestHarvestPos',
          valueType: 'pos',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findClosestHarvestPos(room.roomObjects.source2HarvestPositions.getValue())
          },
     })

     // Upgrade positions

     function findCenterUpgradePos() {
          // Get the anchor, informing false if it's undefined

          if (!room.anchor) return false

          // Get the open areas in a range of 3 to the controller

          const distanceCM = room.distanceTransform(
               undefined,
               false,
               room.controller.pos.x - 2,
               room.controller.pos.y - 2,
               room.controller.pos.x + 2,
               room.controller.pos.y + 2,
          )

          // Find the closest value greater than two to the centerUpgradePos and inform it

          return room.findClosestPosOfValue({
               CM: distanceCM,
               startPos: room.anchor,
               requiredValue: 2,
               reduceIterations: 1,
          })
     }

     new RoomObject({
          name: 'centerUpgradePos',
          valueType: 'pos',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: findCenterUpgradePos,
     })

     function findUpgradePositions() {
          // Get the center upgrade pos, stopping if it's undefined

          const centerUpgradePos = room.roomObjects.centerUpgradePos.getValue()
          if (!centerUpgradePos) return []

          if (!room.anchor) return []

          // Construct harvestPositions

          const upgradePositions = []

          // Find terrain in room

          const terrain = Game.map.getRoomTerrain(room.name)

          // Find positions adjacent to source

          const adjacentPositions = findPositionsInsideRect(
               centerUpgradePos.x - 1,
               centerUpgradePos.y - 1,
               centerUpgradePos.x + 1,
               centerUpgradePos.y + 1,
          )

          // Loop through each pos

          for (const pos of adjacentPositions) {
               // Iterate if terrain for pos is a wall

               if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue

               // Add pos to harvestPositions

               upgradePositions.push(room.newPos(pos))
          }

          upgradePositions.sort(function (a, b) {
               return (
                    getRange(a.x - room.anchor.x, a.y - room.anchor.y) -
                    getRange(b.x - room.anchor.x, b.y - room.anchor.y)
               )
          })

          // Inform harvestPositions

          return upgradePositions
     }

     new RoomObject({
          name: 'upgradePositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: findUpgradePositions,
     })

     function findFastFillerPositions() {
          if (!room.anchor) return []

          // Construct fastFillerPositions from the top / bottom and left, right adjacent positions

          const fastFillerPositions = [
               {
                    x: room.anchor.x - 1,
                    y: room.anchor.y - 1,
               },
               {
                    x: room.anchor.x + 1,
                    y: room.anchor.y - 1,
               },
               {
                    x: room.anchor.x - 1,
                    y: room.anchor.y + 1,
               },
               {
                    x: room.anchor.x + 1,
                    y: room.anchor.y + 1,
               },
          ]

          let adjacentStructures
          let adjacentStructuresByType: Partial<Record<StructureConstant, number>>

          // Loop through each fastFillerPos

          for (let index = fastFillerPositions.length - 1; index >= 0; index -= 1) {
               // Get the pos using the index

               const pos = fastFillerPositions[index]

               // Get adjacent structures

               adjacentStructures = room.lookForAtArea(
                    LOOK_STRUCTURES,
                    pos.y - 1,
                    pos.x - 1,
                    pos.y + 1,
                    pos.x + 1,
                    true,
               )

               // Construct organized adjacent structures

               adjacentStructuresByType = {
                    spawn: 0,
                    extension: 0,
                    container: 0,
                    link: 0,
               }

               // For each structure of adjacentStructures

               for (const adjacentPosData of adjacentStructures) {
                    // Get the structureType at the adjacentPos

                    const { structureType } = adjacentPosData.structure

                    if (adjacentStructuresByType[structureType] === undefined) continue

                    // Increase structure amount for this structureType on the adjacentPos

                    adjacentStructuresByType[structureType] += 1
               }

               // If there is more than one adjacent extension and container, iterate

               if (
                    adjacentStructuresByType[STRUCTURE_CONTAINER] + adjacentStructuresByType[STRUCTURE_LINK] > 0 &&
                    (adjacentStructuresByType[STRUCTURE_SPAWN] > 0 || adjacentStructuresByType[STRUCTURE_EXTENSION] > 1)
               )
                    continue

               // Otherwise, remove the pos from fastFillePositions

               fastFillerPositions.splice(index, 1)
          }

          // Inform fastFillerPositions

          return fastFillerPositions
     }

     new RoomObject({
          name: 'fastFillerPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findFastFillerPositions,
     })

     // Source containers

     function findSourceContainer(closestHarvestPos: RoomPosition) {
          // Stop and inform false if no closestHarvestPos

          if (!closestHarvestPos) return false

          // Look at the closestHarvestPos for structures

          const structuresAsPos = closestHarvestPos.lookFor(LOOK_STRUCTURES)

          // Loop through structuresAtPos

          for (const structure of structuresAsPos) {
               // If the structureType is container, inform the container's ID

               if (structure.structureType === STRUCTURE_CONTAINER) return structure.id
          }

          // Otherwise inform false

          return false
     }

     new RoomObject({
          name: 'source1Container',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findSourceContainer(room.roomObjects.source1ClosestHarvestPos.getValue())
          },
     })

     new RoomObject({
          name: 'source2Container',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findSourceContainer(room.roomObjects.source2ClosestHarvestPos.getValue())
          },
     })

     // usedMineralHarvestPositions

     function findUsedMineralHarvestPositions() {
          // Construct usedHarvestPositions

          const usedHarvestPositions: Set<number> = new Set()

          // Loop through each sourceHarvester's name in the room

          for (const creepName of room.creepsFromRoom.mineralHarvester) {
               // Get the creep using its name

               const creep = Game.creeps[creepName]

               // If the creep is dying, iterate

               if (creep.isDying()) continue

               // If the creep has a packedHarvestPos, record it in usedHarvestPositions

               if (creep.memory.packedPos) usedHarvestPositions.add(creep.memory.packedPos)
          }

          // Inform usedHarvestPositions

          return usedHarvestPositions
     }

     new RoomObject({
          name: 'usedMineralHarvestPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findUsedMineralHarvestPositions,
     })

     // usedSourceHarvestPositions

     function findUsedSourceHarvestPositions() {
          // Construct usedHarvestPositions

          const usedHarvestPositions: Set<number> = new Set()

          // If the room is a commune, use sourceHarvesters. Otherwise use remoteHarvesters

          const harvesterNames =
               room.memory.type === 'commune'
                    ? room.myCreeps.source1Harvester
                           .concat(room.myCreeps.source2Harvester)
                           .concat(room.myCreeps.vanguard)
                    : room.myCreeps.source1RemoteHarvester.concat(room.myCreeps.source2RemoteHarvester)

          for (const creepName of harvesterNames) {
               // Get the creep using its name

               const creep = Game.creeps[creepName]

               // If the creep is dying, iterate

               if (creep.isDying()) continue

               // Get the creep's sourceName

               const { sourceName } = creep.memory

               if (sourceName) room.creepsOfSourceAmount[sourceName] += 1

               // If the creep has a packedHarvestPos, record it in usedHarvestPositions

               if (creep.memory.packedPos) usedHarvestPositions.add(creep.memory.packedPos)
          }

          // Inform usedHarvestPositions

          return usedHarvestPositions
     }

     new RoomObject({
          name: 'usedSourceHarvestPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findUsedSourceHarvestPositions,
     })

     // usedUpgradePositions

     function findUsedUpgradePositions() {
          // Construct usedUpgradePositions

          const usedUpgradePositions: Set<number> = new Set()

          // Get the controllerContainer

          const controllerContainer: StructureContainer = room.roomObjects.controllerContainer.getValue()

          // If there is no controllerContainer

          if (!controllerContainer) {
               // Get the centerUpgradePos and set it as avoid in usedUpgradePositions

               const centerUpgadePos = room.roomObjects.centerUpgradePos.getValue()
               usedUpgradePositions.add(pack(centerUpgadePos))
          }

          // Get the hubAnchor, informing false if it's not defined

          const hubAnchor = unpackAsRoomPos(room.memory.stampAnchors.hub[0], room.name)
          if (!hubAnchor) return false

          // Get the upgradePositions, informing false if they're undefined

          const upgradePositions: RoomPosition[] = room.roomObjects.upgradePositions.getValue()
          if (!upgradePositions.length) return false

          // Assign closestUpgradePos in usedUpgradePositions

          usedUpgradePositions.add(
               pack(
                    hubAnchor.findClosestByPath(upgradePositions, {
                         ignoreCreeps: true,
                         ignoreDestructibleStructures: true,
                         ignoreRoads: true,
                    }),
               ),
          )

          // Loop through each controllerUpgrader's name in the room

          for (const creepName of room.myCreeps.controllerUpgrader) {
               // Get the creep using its name

               const creep = Game.creeps[creepName]

               // If the creep is dying, iterate

               if (creep.isDying()) continue

               // If the creep has a packedUpgradePos, record it in usedUpgradePositions

               if (creep.memory.packedPos) usedUpgradePositions.add(creep.memory.packedPos)
          }

          // Inform usedUpgradePositions

          return usedUpgradePositions
     }

     new RoomObject({
          name: 'usedUpgradePositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findUsedUpgradePositions,
     })

     function findUsedFastFillerPositions() {
          // Construct usedFastFillerPositions

          const usedFastFillerPositions: Set<number> = new Set()

          // Loop through each sourceHarvester's name in the room

          for (const creepName of room.creepsFromRoom.fastFiller) {
               // Get the creep using its name

               const creep = Game.creeps[creepName]

               // If the creep is dying, iterate

               if (creep.isDying()) continue

               // If the creep has a packedFastFillerPos, record it in usedFastFillerPositions

               if (creep.memory.packedPos) usedFastFillerPositions.add(creep.memory.packedPos)
          }

          // Inform usedFastFillerPositions

          return usedFastFillerPositions
     }

     new RoomObject({
          name: 'usedFastFillerPositions',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findUsedFastFillerPositions,
     })

     // controllerContainer

     function findControllerContainer() {
          // Get the centerUpgradePos

          const centerUpgradePos: RoomPosition = room.roomObjects.centerUpgradePos.getValue()

          // Stop and inform false if no centerUpgradePos

          if (!centerUpgradePos) return false

          // Look at the centerUpgradePos for structures

          const structuresAsPos = centerUpgradePos.lookFor(LOOK_STRUCTURES)

          // Loop through structuresAtPos

          for (const structure of structuresAsPos) {
               // If the structureType is container, inform the container's ID

               if (structure.structureType === STRUCTURE_CONTAINER) return structure.id
          }

          // Otherwise inform false

          return false
     }

     new RoomObject({
          name: 'controllerContainer',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: findControllerContainer,
     })

     // mineralContainer

     function findMineralContainer() {
          // Get the mineralHarvestPos, informing false if it's undefined

          const mineralHarvestPos: RoomPosition = room.roomObjects.closestMineralHarvestPos.getValue()
          if (!mineralHarvestPos) return false

          // Look at the mineralHarvestPos for structures

          const structuresAsPos = mineralHarvestPos.lookFor(LOOK_STRUCTURES)

          // Loop through structuresAtPos

          for (const structure of structuresAsPos) {
               // If the structureType is container, inform the container's ID

               if (structure.structureType === STRUCTURE_CONTAINER) return structure.id
          }

          // Otherwise inform false

          return false
     }

     new RoomObject({
          name: 'mineralContainer',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: findMineralContainer,
     })

     // base containers

     function findFastFillerContainer(offset: number) {
          // Get the anchor, stopping if it isn't defined

          if (!room.anchor) return false

          // Otherwise search based on an offset from the anchor's x

          const structuresAsPos = room.lookForAt(LOOK_STRUCTURES, room.anchor.x + offset, room.anchor.y)

          // Loop through structuresAtPos

          for (const structure of structuresAsPos) {
               // If the structureType is container, inform the container's ID

               if (structure.structureType === STRUCTURE_CONTAINER) return structure.id
          }

          // Otherwise inform false

          return false
     }

     new RoomObject({
          name: 'fastFillerContainerLeft',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: () => {
               return findFastFillerContainer(-2)
          },
     })

     new RoomObject({
          name: 'fastFillerContainerRight',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor: () => {
               return findFastFillerContainer(2)
          },
     })

     new RoomObject({
          name: 'labContainer',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {},
     })

     // Links

     function findLinkNearby(anchor: RoomPosition | undefined): Id<Structure> | false {
          // If the anchor isn't defined, inform false

          if (!anchor) return false

          // Otherwise get the room's links

          const links: StructureLink[] = room.get('link')

          // Inform a link's id if it's adjacent to the anchor

          return links.find(link => getRangeBetween(anchor.x, anchor.y, link.pos.x, link.pos.y) === 1)?.id
     }

     new RoomObject({
          name: 'source1Link',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findLinkNearby(room.roomObjects.source1ClosestHarvestPos.getValue())
          },
     })

     new RoomObject({
          name: 'source2Link',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findLinkNearby(room.roomObjects.source2ClosestHarvestPos.getValue())
          },
     })

     function findLinkAtPos(pos: RoomPosition | undefined): Id<Structure> | false {
          // If the pos isn't defined, inform false

          if (!pos) return false

          // Otherwise search based on an offset from the anchor's x

          const structuresAsPos = pos.lookFor(LOOK_STRUCTURES)

          // Loop through structuresAtPos

          for (const structure of structuresAsPos) {
               // If the structureType is link, inform the structures's ID

               if (structure.structureType === STRUCTURE_LINK) return structure.id
          }

          // Otherwise inform false

          return false
     }

     new RoomObject({
          name: 'fastFillerLink',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findLinkAtPos(room.anchor)
          },
     })

     new RoomObject({
          name: 'hubLink',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findLinkNearby(unpackAsRoomPos(room.memory.stampAnchors.hub[0], room.name))
          },
     })

     new RoomObject({
          name: 'controllerLink',
          valueType: 'id',
          cacheType: 'global',
          cacheAmount: Infinity,
          room,
          valueConstructor() {
               return findLinkAtPos(room.roomObjects.centerUpgradePos.getValue())
          },
     })

     // StructuresForSpawning

     function findStructuresForSpawning() {
          // Get the room anchor. If not defined, inform an empty array

          const anchor = room.anchor || new RoomPosition(25, 25, room.name)

          // Get array of spawns and extensions

          const spawnsAndExtensions: (StructureExtension | StructureSpawn)[] = room.roomObjects.spawn
               .getValue()
               .concat(room.roomObjects.extension.getValue())

          // Filter energy structures by distance from anchor

          const filteredSpawnStructures = spawnsAndExtensions.sort(
               (a, b) => a.pos.getRangeTo(anchor.x, anchor.y) - b.pos.getRangeTo(anchor.x, anchor.y),
          )

          return filteredSpawnStructures
     }

     new RoomObject({
          name: 'structuresForSpawning',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor: findStructuresForSpawning,
     })

     // Creeps

     new RoomObject({
          name: 'notMyCreeps',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor() {
               return room.find(FIND_HOSTILE_CREEPS)
          },
     })

     new RoomObject({
          name: 'enemyCreeps',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor() {
               return room.find(FIND_HOSTILE_CREEPS, {
                    filter: creep => !allyList.has(creep.owner.username),
               })
          },
     })

     new RoomObject({
          name: 'allyCreeps',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor() {
               return room.find(FIND_HOSTILE_CREEPS, {
                    filter: creep => allyList.has(creep.owner.username),
               })
          },
     })

     new RoomObject({
          name: 'remoteNamesByEfficacy',
          valueType: 'object',
          cacheType: 'global',
          cacheAmount: 1,
          room,
          valueConstructor() {
               // Filter rooms that have some sourceEfficacies recorded

               const remotesWithEfficacies = room.memory.remotes.filter(function (roomName) {
                    return Memory.rooms[roomName].sourceEfficacies.length
               })

               // Sort the remotes based on the average source efficacy

               return remotesWithEfficacies.sort(function (a1, b1) {
                    return (
                         Memory.rooms[a1].sourceEfficacies.reduce((a2, b2) => a2 + b2) /
                              Memory.rooms[a1].sourceEfficacies.length -
                         Memory.rooms[b1].sourceEfficacies.reduce((a2, b2) => a2 + b2) /
                              Memory.rooms[b1].sourceEfficacies.length
                    )
               })
          },
     })

     // Get the roomObject using it's name

     const roomObject = room.roomObjects[roomObjectName]

     // Inform the roomObject's value

     return roomObject.getValue()
}

Room.prototype.newPos = function (pos: Pos) {
     const room = this

     // Create an return roomPosition

     return new RoomPosition(pos.x, pos.y, room.name)
}

/**
    @param pos1 pos of the object performing the action
    @param pos2 pos of the object getting acted on
    @param [type] The status of action performed
*/
Room.prototype.actionVisual = function (pos1, pos2, type?) {
     const room = this

     // Stop if roomVisuals are disabled

     if (!Memory.roomVisuals) return

     // Construct colors for each type

     const colorsForTypes: { [key: string]: string } = {
          success: constants.colors.lightBlue,
          fail: constants.colors.red,
     }

     // If no type, type is success. Construct type from color

     if (!type) type = 'success'
     const color: string = colorsForTypes[type]

     // Create visuals

     room.visual.circle(pos2.x, pos2.y, { stroke: color })
     room.visual.line(pos1, pos2, { color })
}

interface RoutePart {
     exit: ExitConstant
     room: string
}

type Route = RoutePart[]

/**
 * @param opts options
 * @returns An array of RoomPositions
 */
Room.prototype.advancedFindPath = function (opts: PathOpts): RoomPosition[] {
     const room = this

     // Construct route

     function generateRoute(): Route | undefined {
          // If the goal is in the same room as the origin, inform that no route is needed

          if (opts.origin.roomName === opts.goal.pos.roomName) return undefined

          // Construct route by searching through rooms

          const route = Game.map.findRoute(opts.origin.roomName, opts.goal.pos.roomName, {
               // Essentially a costMatrix for the rooms, priority is for the lower values. Infinity is impassible

               routeCallback(roomName: string) {
                    // If the goal is in the room, inform 1

                    if (roomName === opts.goal.pos.roomName) return 1

                    // Get the room's memory

                    const roomMemory = Memory.rooms[roomName]

                    // If there is no memory for the room, inform impassible

                    if (!roomMemory) return Infinity

                    // If the type is in typeWeights, inform the weight for the type

                    if (opts.typeWeights && opts.typeWeights[roomMemory.type]) return opts.typeWeights[roomMemory.type]

                    // Inform to consider this room

                    return 2
               },
          })

          // If route doesn't work inform undefined

          if (route === ERR_NO_PATH) return undefined

          // Otherwise inform the route

          return route
     }

     // Construct path

     function generatePath() {
          const route = generateRoute()

          const pathFinderResult = PathFinder.search(opts.origin, opts.goal, {
               plainCost: opts.plainCost || 2,
               swampCost: opts.swampCost || 8,
               maxRooms: route ? 100 : 1,
               maxOps: 100000,
               flee: opts.flee,

               // Create costMatrixes for room tiles, where lower values are priority, and 255 or more is considered impassible

               roomCallback(roomName) {
                    // Get the room using the roomName

                    const room = Game.rooms[roomName]

                    // If the type is in typeWeights, inform the weight for the type

                    if (
                         opts.typeWeights &&
                         Memory.rooms[roomName] &&
                         opts.typeWeights[Memory.rooms[roomName].type] === Infinity
                    )
                         return false

                    // Create a costMatrix for the room

                    const cm = new PathFinder.CostMatrix()

                    // If there is no route

                    if (!route) {
                         let y = 0
                         let x = 0

                         // Configure y and loop through top exits

                         y = 0
                         for (x = 0; x < 50; x += 1) cm.set(x, y, 255)

                         // Configure x and loop through left exits

                         x = 0
                         for (y = 0; y < 50; y += 1) cm.set(x, y, 255)

                         // Configure y and loop through bottom exits

                         y = 49
                         for (x = 0; x < 50; x += 1) cm.set(x, y, 255)

                         // Configure x and loop through right exits

                         x = 49
                         for (y = 0; y < 50; y += 1) cm.set(x, y, 255)
                    }

                    weightStructures()

                    function weightStructures() {
                         let roomObjects
                         let weightNum
                         let roomObj

                         for (const weight in opts.weightStructures) {
                              // Use the weight to get the positions

                              roomObjects = opts.weightGamebjects[weight]

                              // Get the numeric value of the weight

                              weightNum = parseInt(weight)

                              // Loop through each gameObject and set their pos to the weight in the cm

                              for (roomObj of roomObjects) cm.set(roomObj.pos.x, roomObj.pos.y, weightNum)
                         }
                    }

                    weightGamebjects()

                    function weightGamebjects() {
                         let roomObjects
                         let weightNum
                         let roomObj

                         for (const weight in opts.weightGamebjects) {
                              // Use the weight to get the positions

                              roomObjects = opts.weightGamebjects[weight]

                              // Get the numeric value of the weight

                              weightNum = parseInt(weight)

                              // Loop through each gameObject and set their pos to the weight in the cm

                              for (roomObj of roomObjects) cm.set(roomObj.pos.x, roomObj.pos.y, weightNum)
                         }
                    }

                    weightPositions()

                    function weightPositions() {
                         let positions
                         let weightNum
                         let pos

                         for (const weight in opts.weightPositions) {
                              // Use the weight to get the positions

                              positions = opts.weightPositions[weight]

                              // Get the numeric value of the weight

                              weightNum = parseInt(weight)

                              // Loop through each gameObject and set their pos to the weight in the cm

                              for (pos of positions) cm.set(pos.x, pos.y, weightNum)
                         }
                    }

                    weightCostMatrixes()

                    function weightCostMatrixes() {
                         // Stop if there are no cost matrixes to weight

                         if (!opts.weightCostMatrixes) return

                         // Otherwise iterate through each x and y in the room

                         for (let x = 0; x < constants.roomDimensions; x += 1) {
                              for (let y = 0; y < constants.roomDimensions; y += 1) {
                                   // Loop through each costMatrix

                                   for (const weightCM of opts.weightCostMatrixes)
                                        if (weightCM) cm.set(x, y, weightCM.get(x, y))
                              }
                         }
                    }

                    // If there is no vision in the room, inform the costMatrix

                    if (!room) return cm

                    for (const portal of room.structures.portal) cm.set(portal.pos.x, portal.pos.y, 255)

                    // Loop trough each construction site belonging to an ally

                    for (const cSite of room.get('allyCSites')) cm.set(cSite.x, cSite.y, 255)

                    // If there is a request to avoid enemy ranges

                    avoidEnemyRanges()

                    function avoidEnemyRanges() {
                         // Stop if avoidEnemyRanges isn't specified

                         if (!opts.avoidEnemyRanges) return

                         // Stop if the is a controller, it's mine, and it's in safemode

                         if (room.controller && room.controller.my && room.controller.safeMode) return

                         // Get enemies and loop through them

                         const enemyAttackers: Creep[] = []
                         const enemyRangedAttackers: Creep[] = []

                         for (const enemyCreep of room.enemyCreeps) {
                              if (enemyCreep.hasPartsOfTypes([RANGED_ATTACK])) {
                                   enemyRangedAttackers.push(enemyCreep)
                                   return
                              }

                              if (enemyCreep.hasPartsOfTypes([ATTACK])) enemyAttackers.push(enemyCreep)
                         }

                         for (const enemyAttacker of enemyAttackers) {
                              // Construct rect and get positions inside

                              const positions = findPositionsInsideRect(
                                   enemyAttacker.pos.x - 2,
                                   enemyAttacker.pos.y - 2,
                                   enemyAttacker.pos.x + 2,
                                   enemyAttacker.pos.y + 2,
                              )

                              // Loop through positions and set them as impassible

                              for (const pos of positions) cm.set(pos.x, pos.y, 255)
                         }

                         for (const enemyAttacker of enemyRangedAttackers) {
                              // Construct rect and get positions inside

                              const positions = findPositionsInsideRect(
                                   enemyAttacker.pos.x - 3,
                                   enemyAttacker.pos.y - 3,
                                   enemyAttacker.pos.x + 3,
                                   enemyAttacker.pos.y + 3,
                              )

                              // Loop through positions and set them as impassible

                              for (const pos of positions) cm.set(pos.x, pos.y, 255)
                         }
                    }

                    if (opts.avoidNotMyCreeps) {
                         for (const creep of room.find(FIND_HOSTILE_CREEPS)) cm.set(creep.pos.x, creep.pos.y, 255)

                         for (const creep of room.find(FIND_HOSTILE_POWER_CREEPS)) cm.set(creep.pos.x, creep.pos.y, 255)
                    }

                    // If avoiding structures that can't be walked on is enabled

                    if (opts.avoidImpassibleStructures) {
                         // Get and loop through ramparts

                         const ramparts = room.structures.rampart

                         for (const rampart of ramparts) {
                              // If the rampart is mine

                              if (rampart.my) {
                                   // If there is no weight for my ramparts, iterate

                                   if (!opts.myRampartWeight) continue

                                   // Otherwise, record rampart by the weight and iterate

                                   cm.set(rampart.pos.x, rampart.pos.y, opts.myRampartWeight)
                                   continue
                              }

                              // Otherwise if the rampart is owned by an ally, iterate

                              if (rampart.isPublic) continue

                              // Otherwise set the rampart's pos as impassible

                              cm.set(rampart.pos.x, rampart.pos.y, 255)
                         }

                         // Loop through structureTypes of impassibleStructureTypes

                         for (const structureType of constants.impassibleStructureTypes) {
                              for (const structure of room.structures[structureType]) {
                                   // Set pos as impassible

                                   cm.set(structure.pos.x, structure.pos.y, 255)
                              }

                              for (const cSite of room.cSites[structureType]) {
                                   // Set pos as impassible

                                   cm.set(cSite.pos.x, cSite.pos.y, 255)
                              }
                         }
                    }

                    // If avoidStationaryPositions is requested

                    if (opts.avoidStationaryPositions) {
                         // Construct the sourceNames

                         const sources: ('source1' | 'source2')[] = ['source1', 'source2']

                         // Loop through them

                         for (const sourceName of sources) {
                              // Find harvestPositions for sourceNames, iterating if there are none

                              const harvestPositions: Pos[] = room.get(`${sourceName}HarvestPositions`)
                              if (!harvestPositions.length) continue

                              // Loop through each position of harvestPositions, have creeps prefer to avoid

                              for (const pos of harvestPositions) cm.set(pos.x, pos.y, 10)
                         }

                         // If the anchor is defined

                         if (room.anchor) {
                              // Get the upgradePositions, and use the anchor to find the closest upgradePosition to the anchor

                              const upgradePositions: RoomPosition[] = room.get('upgradePositions')
                              const deliverUpgradePos = room.anchor.findClosestByPath(upgradePositions, {
                                   ignoreCreeps: true,
                                   ignoreDestructibleStructures: true,
                                   ignoreRoads: true,
                              })

                              // Loop through each pos of upgradePositions, assigning them as prefer to avoid in the cost matrix

                              for (const pos of upgradePositions) {
                                   // If the pos and deliverUpgradePos are the same, iterate

                                   if (arePositionsEqual(pos, deliverUpgradePos)) continue

                                   // Otherwise have the creep prefer to avoid the pos

                                   cm.set(pos.x, pos.y, 10)
                              }
                         }

                         // Get the hubAnchor

                         const hubAnchor =
                              room.memory.stampAnchors && room.memory.stampAnchors.hub[0]
                                   ? unpackAsRoomPos(room.memory.stampAnchors.hub[0], roomName)
                                   : undefined

                         // If the hubAnchor is defined

                         if (hubAnchor) cm.set(hubAnchor.x, hubAnchor.y, 10)

                         // Get fastFillerPositions

                         const fastFillerPositions: Pos[] = room.get('fastFillerPositions')

                         // If there are fastFillerPositions

                         if (fastFillerPositions.length) {
                              // Loop through each position of fastFillerPositions, have creeps prefer to avoid

                              for (const pos of fastFillerPositions) cm.set(pos.x, pos.y, 10)
                         }
                    }

                    // Inform the CostMatrix

                    return cm
               },
          })

          // If the pathFindResult is incomplete, inform an empty array

          if (pathFinderResult.incomplete) {
               customLog(
                    'Incomplete Path',
                    `${pathFinderResult.path}, ${JSON.stringify(opts.goal.pos)}`,
                    constants.colors.white,
                    constants.colors.red,
               )

               room.pathVisual(pathFinderResult.path, 'red')
               room.visual.line(opts.origin, opts.goal.pos, {
                    color: constants.colors.red,
                    width: 0.15,
                    opacity: 0.3,
                    lineStyle: 'solid',
               })

               return []
          }

          // Otherwise inform the path from pathFinderResult

          return pathFinderResult.path
     }

     // Call path generation and inform the result

     return generatePath()
}

Room.prototype.findType = function (scoutingRoom: Room) {
     const room = this
     const { controller } = room

     // Record that the room was scouted this tick

     room.memory.lastScout = Game.time

     // Find the numbers in the room's name

     const [EWstring, NSstring] = room.name.match(/\d+/g)

     // Convert he numbers from strings into actual numbers

     const EW = parseInt(EWstring)
     const NS = parseInt(NSstring)

     // Use the numbers to deduce some room types - quickly!

     if (EW % 10 === 0 && NS % 10 === 0) {
          room.memory.type = 'intersection'
          return
     }

     if (EW % 10 === 0 || NS % 10 === 0) {
          room.memory.type = 'highway'
          return
     }

     if (EW % 5 === 0 && NS % 5 === 0) {
          room.memory.type = 'keeperCenter'
          return
     }

     if (Math.abs(5 - (EW % 10)) <= 1 && Math.abs(5 - (NS % 10)) <= 1) {
          room.memory.type = 'keeper'
          return
     }

     // If there is a controller

     if (controller) {
          // If the contoller is owned

          if (controller.owner) {
               // Stop if the controller is owned by me

               if (controller.my) return

               // If the controller is owned by an ally

               if (allyList.has(controller.owner.username)) {
                    // Set the type to ally and stop

                    room.memory.type = 'ally'
                    room.memory.owner = controller.owner.username
                    return
               }

               // If the controller is not owned by an ally

               // Set the type to enemy and stop

               room.memory.type = 'enemy'
               room.memory.owner = controller.owner.username
               room.memory.level = controller.level
               room.memory.powerEnabled = controller.isPowerEnabled
               room.memory.terminal = room.terminal !== undefined
               room.memory.storedEnergy = room.findStoredResourceAmount(RESOURCE_ENERGY)
               return
          }

          // Filter sources that have been harvested

          const harvestedSources = room.find(FIND_SOURCES).filter(source => source.ticksToRegeneration > 0)

          if (isReservedRemote()) return

          function isReservedRemote(): boolean {
               // If there is no reservation inform false

               if (!controller.reservation) return false

               // If I am the reserver, inform false

               if (controller.reservation.username === Memory.me) return false

               // If the reserver is an Invader, inform false

               if (controller.reservation.username === 'Invader') return false

               // Get roads

               const roads: StructureRoad[] = room.get('road')

               // Get containers

               const containers: StructureContainer[] = room.get('container')

               // If there are roads or containers or sources harvested, inform false

               if (roads.length === 0 && containers.length === 0 && !harvestedSources) return false

               // If the controller is not reserved by an ally

               if (!allyList.has(controller.reservation.username)) {
                    // Set type to enemyRemote and inform true

                    room.memory.type = 'enemyRemote'
                    room.memory.owner = controller.reservation.username
                    return true
               }

               // Otherwise if the room is reserved by an ally

               // Set type to allyRemote and inform true

               room.memory.type = 'allyRemote'
               room.memory.owner = controller.reservation.username
               return true
          }

          if (isUnReservedRemote()) return

          function isUnReservedRemote() {
               if (controller.reservation) {
                    // If I am the reserver, inform false

                    if (controller.reservation.username === Memory.me) return false

                    // If the reserver is an Invader, inform false

                    if (controller.reservation.username === 'Invader') return false
               }

               // If there are no sources harvested

               if (harvestedSources.length === 0) return false

               // Find creeps that I don't own that aren't invaders

               const creepsNotMine: Creep[] = room.get('enemyCreeps').concat(room.get('allyCreeps'))

               // Iterate through them

               for (const creep of creepsNotMine) {
                    // If the creep is an invdader, iterate

                    if (creep.owner.username === 'Invader') continue

                    // If the creep has work parts

                    if (creep.hasPartsOfTypes([WORK])) {
                         // If the creep is owned by an ally

                         if (allyList.has(creep.owner.username)) {
                              // Set type to allyRemote and stop

                              room.memory.type = 'allyRemote'
                              room.memory.owner = creep.owner.username
                              return true
                         }

                         // If the creep is not owned by an ally

                         // Set type to enemyRemote and stop

                         room.memory.type = 'enemyRemote'
                         room.memory.owner = creep.owner.username
                         return true
                    }
               }

               return false
          }

          if (room.makeRemote(scoutingRoom)) return

          room.memory.type = 'neutral'

          room.createClaimRequest()
     }
}

Room.prototype.makeRemote = function (scoutingRoom) {
     const room = this

     let distance = Game.map.getRoomLinearDistance(scoutingRoom.name, room.name)

     // Find distance from scoutingRoom

     if (distance < 4) distance = advancedFindDistance(scoutingRoom.name, room.name, {
          keeper: Infinity,
          enemy: Infinity,
          enemyRemote: Infinity,
          ally: Infinity,
          allyRemote: Infinity,
          highway: Infinity,
     })

     if (distance < 4) {
          // If the room is already a remote of the scoutingRoom

          if (room.memory.type === 'remote' && scoutingRoom.name === room.memory.commune) return true

          // Get the anchor from the scoutingRoom, stopping if it's undefined

          if (!scoutingRoom.anchor) return true

          const newSourceEfficacies = []

          // Get base planning data

          // Get the room's sourceNames

          const sourceNames: ('source1' | 'source2')[] = ['source1', 'source2']

          // loop through sourceNames

          for (const sourceName of sourceNames) {
               // Get the source using sourceName, stopping the loop if undefined

               const source: Source = room.get(sourceName)
               if (!source) break

               const path = room.advancedFindPath({
                    origin: source.pos,
                    goal: { pos: scoutingRoom.anchor, range: 3 },
                    /* weightCostMatrixes: [roadCM] */
               })

               // Record the length of the path in the room's memory

               newSourceEfficacies.push(path.length)

               /*
            // Loop through positions of the path

            for (const pos of path) {

                // Record the pos in roadCM

                roadCM.set(pos.x, pos.y, 1)

                // Plan for a road at this position

                structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
            }
            */
          }

          // If the room isn't already a remote

          if (room.memory.type !== 'remote' || !Memory.communes.includes(room.memory.commune)) {
               room.memory.type = 'remote'

               // Assign the room's commune as the scoutingRoom

               room.memory.commune = scoutingRoom.name

               // Add the room's name to the scoutingRoom's remotes list

               scoutingRoom.memory.remotes.push(room.name)

               // Construct needs and sourceEfficacies

               room.memory.needs = []
               room.memory.sourceEfficacies = newSourceEfficacies
               return true
          }

          const currentAvgSourceEfficacy =
               room.memory.sourceEfficacies.reduce((sum, el) => sum + el) / room.memory.sourceEfficacies.length
          const newAvgSourceEfficacy = newSourceEfficacies.reduce((sum, el) => sum + el) / newSourceEfficacies.length

          // If the new average source efficacy is above the current, stop

          if (newAvgSourceEfficacy >= currentAvgSourceEfficacy) return true

          room.memory.type = 'remote'

          // Assign the room's commune as the scoutingRoom

          room.memory.commune = scoutingRoom.name

          // Add the room's name to the scoutingRoom's remotes list

          scoutingRoom.memory.remotes.push(room.name)

          // Construct needs and sourceEfficacies

          room.memory.needs = []
          room.memory.sourceEfficacies = newSourceEfficacies
          return true
     }

     if (room.memory.type !== 'remote') return false

     if (!Memory.communes.includes(room.memory.commune)) return false

     return true
}

Room.prototype.cleanMemory = function () {
     const room = this

     // Stop if the room doesn't have a type

     if (!room.memory.type) return

     // Loop through keys in the room's memory

     for (const key in room.memory) {
          // Iterate if key is not part of roomTypeProperties

          if (!constants.roomTypeProperties[key]) continue

          // Iterate if key part of this roomType's properties

          if (constants.roomTypes[room.memory.type][key]) continue

          // Delete the property

          delete room.memory[key]
     }
}

Room.prototype.findStoredResourceAmount = function (resourceType) {
     const room = this

     // If room.storedResources doesn't exist, construct it

     if (!room.storedResources) room.storedResources = {}
     // Otherwise if there is already data about the storedResources, inform it
     else if (room.storedResources[resourceType]) return room.storedResources[resourceType]

     // Otherwise construct the number for this stored resource

     room.storedResources[resourceType] = 0

     // Create array of room and terminal

     const storageStructures = [room.storage, room.terminal]

     // Iterate through storageStructures

     for (const storageStructure of storageStructures) {
          // Iterate if storageStructure isn't defined

          if (!storageStructure) continue

          // Add the amount of resources in the storageStructure to the rooms storedResources of resourceType

          room.storedResources[resourceType] += storageStructure.store.getUsedCapacity(resourceType)
     }

     // Inform room's storedResources of resourceType

     return room.storedResources[resourceType]
}

Room.prototype.findTasksOfTypes = function (createdTaskIDs, types) {
     const room = this

     // Initialize tasks of types

     const tasksOfTypes = []

     // Iterate through IDs of createdTasks

     for (const taskID in createdTaskIDs) {
          // Set the task from tasks without responders, or if undefined, from tasksWithResponders

          const task: RoomTask = room.global.tasksWithoutResponders[taskID] || room.global.tasksWithResponders[taskID]

          // If the task isn't defined, iterate

          if (!task) continue

          // If the task is not of the specified types, iterate

          if (!types.has(task.type)) continue

          // Otherwise add the task to tasksOfTypes

          tasksOfTypes.push(task)
     }

     // Inform false if no tasks had the specified types

     return tasksOfTypes
}

Room.prototype.distanceTransform = function (
     initialCM,
     enableVisuals,
     x1 = 0,
     y1 = 0,
     x2 = constants.roomDimensions,
     y2 = constants.roomDimensions,
) {
     const room = this

     // Use a costMatrix to record distances

     const distanceCM = new PathFinder.CostMatrix()

     if (!initialCM) initialCM = room.get('terrainCM')

     for (let x = Math.max(x1 - 1, 0); x <= Math.min(x2 + 1, constants.roomDimensions); x += 1) {
          for (let y = Math.max(y1 - 1, 0); y <= Math.min(y2 + 1, constants.roomDimensions); y += 1) {
               distanceCM.set(x, y, initialCM.get(x, y) === 255 ? 0 : 255)
          }
     }

     let top: number
     let left: number
     let topLeft: number
     let topRight: number
     let bottomLeft: number

     // Loop through the xs and ys inside the bounds

     for (let x = x1; x <= x2; x += 1) {
          for (let y = y1; y <= y2; y += 1) {
               top = distanceCM.get(x, y - 1)
               left = distanceCM.get(x - 1, y)
               topLeft = distanceCM.get(x - 1, y - 1)
               topRight = distanceCM.get(x + 1, y - 1)
               bottomLeft = distanceCM.get(x - 1, y + 1)

               distanceCM.set(
                    x,
                    y,
                    Math.min(Math.min(top, left, topLeft, topRight, bottomLeft) + 1, distanceCM.get(x, y)),
               )
          }
     }

     let bottom: number
     let right: number
     let bottomRight: number

     // Loop through the xs and ys inside the bounds

     for (let x = x2; x >= x1; x -= 1) {
          for (let y = y2; y >= y1; y -= 1) {
               bottom = distanceCM.get(x, y + 1)
               right = distanceCM.get(x + 1, y)
               bottomRight = distanceCM.get(x + 1, y + 1)
               topRight = distanceCM.get(x + 1, y - 1)
               bottomLeft = distanceCM.get(x - 1, y + 1)

               distanceCM.set(
                    x,
                    y,
                    Math.min(Math.min(bottom, right, bottomRight, topRight, bottomLeft) + 1, distanceCM.get(x, y)),
               )
          }
     }

     if (enableVisuals && Memory.roomVisuals) {
          // Loop through the xs and ys inside the bounds

          for (let x = x1; x <= x2; x += 1) {
               for (let y = y1; y <= y2; y += 1) {
                    room.visual.rect(x - 0.5, y - 0.5, 1, 1, {
                         fill: `hsl(${200}${distanceCM.get(x, y) * 10}, 100%, 60%)`,
                         opacity: 0.4,
                    })
               }
          }
     }

     return distanceCM
}

Room.prototype.specialDT = function (
     initialCM,
     enableVisuals,
     x1 = 0,
     y1 = 0,
     x2 = constants.roomDimensions,
     y2 = constants.roomDimensions,
) {
     const room = this

     // Use a costMatrix to record distances

     const distanceCM = new PathFinder.CostMatrix()

     if (!initialCM) initialCM = room.get('terrainCM')

     for (let x = x1; x <= x2; x += 1) {
          for (let y = y1; y <= y2; y += 1) {
               distanceCM.set(x, y, initialCM.get(x, y) === 255 ? 0 : 255)
          }
     }

     let top: number
     let left: number

     // Loop through the xs and ys inside the bounds

     for (let x = x1; x <= x2; x += 1) {
          for (let y = y1; y <= y2; y += 1) {
               top = distanceCM.get(x, y - 1)
               left = distanceCM.get(x - 1, y)

               distanceCM.set(x, y, Math.min(Math.min(top, left) + 1, distanceCM.get(x, y)))
          }
     }

     let bottom: number
     let right: number

     // Loop through the xs and ys inside the bounds

     for (let x = x2; x >= x1; x -= 1) {
          for (let y = y2; y >= y1; y -= 1) {
               bottom = distanceCM.get(x, y + 1)
               right = distanceCM.get(x + 1, y)

               distanceCM.set(x, y, Math.min(Math.min(bottom, right) + 1, distanceCM.get(x, y)))
          }
     }

     if (enableVisuals && Memory.roomVisuals) {
          // Loop through the xs and ys inside the bounds

          for (let x = x1; x <= x2; x += 1) {
               for (let y = y1; y <= y2; y += 1) {
                    room.visual.rect(x - 0.5, y - 0.5, 1, 1, {
                         fill: `hsl(${200}${distanceCM.get(x, y) * 10}, 100%, 60%)`,
                         opacity: 0.4,
                    })
               }
          }
     }

     return distanceCM
}

Room.prototype.floodFill = function (seeds) {
     const room = this

     // Construct a cost matrix for the flood

     const floodCM = new PathFinder.CostMatrix()
     // Get the terrain cost matrix

     const terrain = room.getTerrain()
     // Construct a cost matrix for visited tiles and add seeds to it

     const visitedCM = new PathFinder.CostMatrix()

     // Construct values for the flood

     let depth = 0
     let thisGeneration: Pos[] = seeds
     let nextGeneration: Pos[] = []

     // Loop through positions of seeds

     for (const pos of seeds) {
          // Record the seedsPos as visited

          visitedCM.set(pos.x, pos.y, 1)
     }

     // So long as there are positions in this gen

     while (thisGeneration.length) {
          // Reset next gen

          nextGeneration = []

          // Iterate through positions of this gen

          for (const pos of thisGeneration) {
               // If the depth isn't 0

               if (depth !== 0) {
                    // Iterate if the terrain is a wall

                    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue

                    // Otherwise so long as the pos isn't a wall record its depth in the flood cost matrix

                    floodCM.set(pos.x, pos.y, depth)

                    // If visuals are enabled, show the depth on the pos

                    if (Memory.roomVisuals)
                         room.visual.rect(pos.x - 0.5, pos.y - 0.5, 1, 1, {
                              fill: `hsl(${200}${depth * 2}, 100%, 60%)`,
                              opacity: 0.4,
                         })
               }

               // Construct a rect and get the positions in a range of 1

               const adjacentPositions = findPositionsInsideRect(pos.x - 1, pos.y - 1, pos.x + 1, pos.y + 1)

               // Loop through adjacent positions

               for (const adjacentPos of adjacentPositions) {
                    // Iterate if the adjacent pos has been visited or isn't a tile

                    if (visitedCM.get(adjacentPos.x, adjacentPos.y) === 1) continue

                    // Otherwise record that it has been visited

                    visitedCM.set(adjacentPos.x, adjacentPos.y, 1)

                    // Add it to the next gen

                    nextGeneration.push(adjacentPos)
               }
          }

          // Set this gen to next gen

          thisGeneration = nextGeneration

          // Increment depth

          depth += 1
     }

     return floodCM
}

Room.prototype.findClosestPosOfValue = function (opts) {
     const room = this

     /**
      *
      */
     function isViableAnchor(pos: Pos): boolean {
          // Get the value of the pos

          const posValue = opts.CM.get(pos.x, pos.y)

          // If the value is to avoid, inform false

          if (posValue === 255) return false

          // If the posValue is less than the requiredValue, inform false

          if (posValue < opts.requiredValue) return false

          // If adjacentToRoads is a requirement

          if (opts.adjacentToRoads) {
               // Construct a rect and get the positions in a range of 1

               const adjacentPositions = findPositionsInsideRect(pos.x - 1, pos.y - 1, pos.x + 1, pos.y + 1)

               // Construct a default no for nearby roads

               let nearbyRoad = false

               // Loop through adjacent positions

               for (const adjacentPos of adjacentPositions) {
                    // If the adjacentPos isn't a roadPosition, iterate

                    if (opts.roadCM.get(adjacentPos.x, adjacentPos.y) !== 1) continue

                    // Otherwise set nearbyRoad to true and stop the loop

                    nearbyRoad = true
                    break
               }

               // If nearbyRoad is false, inform false

               if (!nearbyRoad) return false
          }

          // Inform true

          return true
     }

     while ((opts.reduceIterations || 0) >= 0) {
          // Construct a cost matrix for visited tiles and add seeds to it

          const visitedCM = new PathFinder.CostMatrix()

          // Record startPos as visited

          visitedCM.set(opts.startPos.x, opts.startPos.y, 1)

          // Construct values for the check

          let thisGeneration: Pos[] = [opts.startPos]
          let nextGeneration: Pos[] = []
          let canUseWalls = true

          // So long as there are positions in this gen

          while (thisGeneration.length) {
               // Reset nextGeneration

               nextGeneration = []

               // Iterate through positions of this gen

               for (const pos of thisGeneration) {
                    // If the pos can be an anchor, inform it

                    if (isViableAnchor(pos)) return room.newPos(pos)

                    // Otherwise construct a rect and get the positions in a range of 1 (not diagonals)

                    const adjacentPositions = [
                         {
                              x: pos.x - 1,
                              y: pos.y,
                         },
                         {
                              x: pos.x + 1,
                              y: pos.y,
                         },
                         {
                              x: pos.x,
                              y: pos.y - 1,
                         },
                         {
                              x: pos.x,
                              y: pos.y + 1,
                         },
                    ]

                    // Loop through adjacent positions

                    for (const adjacentPos of adjacentPositions) {
                         // Iterate if the pos doesn't map onto a room

                         if (
                              adjacentPos.x < 0 ||
                              adjacentPos.x >= constants.roomDimensions ||
                              adjacentPos.y < 0 ||
                              adjacentPos.y >= constants.roomDimensions
                         )
                              continue

                         // Iterate if the adjacent pos has been visited or isn't a tile

                         if (visitedCM.get(adjacentPos.x, adjacentPos.y) === 1) continue

                         // Otherwise record that it has been visited

                         visitedCM.set(adjacentPos.x, adjacentPos.y, 1)

                         // If canUseWalls is enabled and the terrain isnt' a wall, disable canUseWalls

                         if (canUseWalls && opts.CM.get(adjacentPos.x, adjacentPos.y) !== 255) canUseWalls = false

                         // Add it tofastFillerSide the next gen

                         nextGeneration.push(adjacentPos)
                    }
               }

               // Set this gen to next gen

               thisGeneration = nextGeneration
          }

          opts.reduceIterations -= 1
          opts.requiredValue -= 1
     }

     // Inform false if no value was found

     return false
}

Room.prototype.pathVisual = function (path, color) {
     const room = this

     // Stop if roomVisuals are disabled

     if (!Memory.roomVisuals) return

     if (!path.length) return

     // Filter only positions in the path that are in the path's starting room

     const currentRoomName = path[0].roomName

     for (let index = 0; index < path.length; index += 1) {
          const pos = path[index]

          if (pos.roomName === currentRoomName) continue

          path.splice(index, path.length - 1)
          break
     }

     // Generate the visual

     room.visual.poly(path, {
          stroke: constants.colors[color],
          strokeWidth: 0.15,
          opacity: 0.3,
          lineStyle: 'solid',
     })
}

Room.prototype.findCSiteTargetID = function (creep) {
     const room = this

     // Find my construction sites

     const myCSites = room.find(FIND_MY_CONSTRUCTION_SITES)

     // If there are no sites inform false

     if (!myCSites.length) return false

     // Loop through structuretypes of the build priority

     for (const structureType of constants.structureTypesByBuildPriority) {
          // Get the structures with the relevant type

          const cSitesOfType: ConstructionSite[] = room.get(`${structureType}CSite`)

          // If there are no cSites of this type, iterate

          if (!cSitesOfType.length) continue

          // Ptherwise get the anchor, using the creep's pos if undefined, or using the center of the room if there is no creep

          const anchor: RoomPosition = room.anchor || creep?.pos || new RoomPosition(25, 25, room.name)

          // Record the closest site to the anchor in the room's global and inform true

          room.memory.cSiteTargetID = anchor.findClosestByPath(cSitesOfType, {
               ignoreCreeps: true,
               ignoreDestructibleStructures: true,
               ignoreRoads: true,
          }).id
          return true
     }

     // If no cSiteTarget was found, inform false

     return false
}

Room.prototype.groupRampartPositions = function (rampartPositions, rampartPlans) {
     const room = this

     // Construct a costMatrix to store visited positions

     const visitedCM = new PathFinder.CostMatrix()

     // Construct storage of position groups

     const groupedPositions = []

     // Construct the groupIndex

     let groupIndex = 0

     // Loop through each pos of positions

     for (const packedPos of rampartPositions) {
          const pos = unpackAsPos(packedPos)

          // If the pos has already been visited, iterate

          if (visitedCM.get(pos.x, pos.y) === 1) continue

          // Record that this pos has been visited

          visitedCM.set(pos.x, pos.y, 1)

          // Construct the group for this index with the pos in it the group

          groupedPositions[groupIndex] = [new RoomPosition(pos.x, pos.y, room.name)]

          // Construct values for floodFilling

          let thisGeneration = [pos]

          let nextGeneration: Pos[] = []

          // So long as there are positions in this gen

          while (thisGeneration.length) {
               // Reset next gen

               nextGeneration = []

               // Iterate through positions of this gen

               for (const pos of thisGeneration) {
                    // Construct a rect and get the positions in a range of 1 (not diagonals)

                    const adjacentPositions = findPositionsInsideRect(pos.x - 1, pos.y - 1, pos.x + 1, pos.y + 1)

                    // Loop through adjacent positions

                    for (const adjacentPos of adjacentPositions) {
                         // Iterate if adjacentPos is out of room bounds

                         if (
                              adjacentPos.x <= 0 ||
                              adjacentPos.x >= constants.roomDimensions ||
                              adjacentPos.y <= 0 ||
                              adjacentPos.y >= constants.roomDimensions
                         )
                              continue

                         // Iterate if the adjacent pos has been visited or isn't a tile

                         if (visitedCM.get(adjacentPos.x, adjacentPos.y) === 1) continue

                         // Otherwise record that it has been visited

                         visitedCM.set(adjacentPos.x, adjacentPos.y, 1)

                         // If a rampart is not planned for this position, iterate

                         if (rampartPlans.get(adjacentPos.x, adjacentPos.y) !== 1) continue

                         // Add it to the next gen and this group

                         nextGeneration.push(adjacentPos)

                         groupedPositions[groupIndex].push(new RoomPosition(adjacentPos.x, adjacentPos.y, room.name))
                    }
               }

               // Set this gen to next gen

               thisGeneration = nextGeneration
          }

          // Increase the groupIndex

          groupIndex += 1
     }

     // Inform groupedPositions

     return groupedPositions
}

Room.prototype.createPullTask = function (creator) {
     const room = this
}

Room.prototype.createPickupTasks = function (creator) {
     const room = this
}

Room.prototype.createOfferTasks = function (creator) {
     const room = this
}

Room.prototype.createTransferTasks = function (creator) {
     const room = this
}

Room.prototype.createWithdrawTasks = function (creator) {
     const room = this
}

Room.prototype.estimateIncome = function () {
     const room = this

     const harvesterNames = room.creepsFromRoom.source1Harvester
          .concat(room.creepsFromRoom.source2Harvester)
          .concat(room.creepsFromRoom.source1RemoteHarvester)
          .concat(room.creepsFromRoom.source2RemoteHarvester)

     // Construct income starting at 0

     let income = 0

     for (const creepName of harvesterNames) {
          // Get the creep using creepName

          const creep = Game.creeps[creepName]

          // Add the number of work parts owned by the creep at a max of 5, times harvest power

          income += Math.min(5, creep.partsOfType(WORK)) * HARVEST_POWER
     }

     // Inform income

     return income
}

Room.prototype.findRoomPositionsInsideRect = function (x1, y1, x2, y2) {
     const room = this

     // Construct positions

     const positions: RoomPosition[] = []

     // Loop through coordinates inside the rect

     for (let x = x1; x <= x2; x += 1) {
          for (let y = y1; y <= y2; y += 1) {
               // Iterate if the pos doesn't map onto a room

               if (x < 0 || x >= constants.roomDimensions || y < 0 || y >= constants.roomDimensions) continue

               // Otherwise ass the x and y to positions

               positions.push(new RoomPosition(x, y, room.name))
          }
     }

     // Inform positions

     return positions
}

Room.prototype.getPartsOfRoleAmount = function (role, type) {
     const room = this

     // Intilaize the partsAmount

     let partsAmount = 0

     // Loop through every creepName in the creepsFromRoom of the specified role

     for (const creepName of room.creepsFromRoom[role]) {
          // Get the creep using creepName

          const creep = Game.creeps[creepName]

          // If there is no specified type

          if (!type) {
               // Increase partsAmount by the creep's body size, and iterate

               partsAmount += creep.body.length
               continue
          }

          // Otherwise increase partsAmount by the creep's parts count of the specified type

          partsAmount += creep.body.filter(part => part.type === type).length
     }

     // Inform partsAmount

     return partsAmount
}

Room.prototype.findSourcesByEfficacy = function () {
     const room = this

     // Get the room's sourceNames

     const sourceNames: ('source1' | 'source2')[] = ['source1', 'source2']

     // Sort sourceNames based on their efficacy, informing the result

     return sourceNames.sort((a, b) => room.global[a] - room.global[b])
}

Room.prototype.createClaimRequest = function () {
     if (this.get('sources').length !== 2) return false

     if (this.memory.notClaimable) return false

     if (Memory.claimRequests[this.name]) return false

     basePlanner(this)

     if (!this.memory.planned) return false

     let score = 0

     // Prefer communes not too close and not too far from the commune

     const closestClaimTypeName = findClosestClaimType(this.name)
     const closestCommuneRange = Game.map.getRoomLinearDistance(closestClaimTypeName, this.name)
     const preference = Math.abs(prefferedCommuneRange - closestCommuneRange)

     score += preference

     score += this.findSwampPlainsRatio() * 12

     Memory.claimRequests[this.name] = {
          needs: [1, 20, 0],
          score,
     }

     return true
}

Room.prototype.findSwampPlainsRatio = function () {
     const terrainAmounts: number[] = [0, 0, 0]

     const terrain = this.getTerrain()

     for (let x = 0; x < constants.roomDimensions; x += 1) {
          for (let y = 0; y < constants.roomDimensions; y += 1) {
               terrainAmounts[terrain.get(x, y)] += 1
          }
     }

     return terrainAmounts[TERRAIN_MASK_SWAMP] / terrainAmounts[0]
}
