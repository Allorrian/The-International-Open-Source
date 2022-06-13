import { allyList, constants, stamps } from 'international/constants'
import { customLog, findObjectWithID, unpackAsPos } from 'international/generalFunctions'

/**
 * Adds annotations to the room if roomVisuals are enabled
 */
export function roomVisualsManager(room: Room) {
     // Stop if roomVisuals are disabled

     if (!Memory.roomVisuals) return

     // If CPU logging is enabled, get the CPU used at the start

     if (Memory.cpuLogging) var managerCPUStart = Game.cpu.getUsed()

     // If there is an anchor, show a rectangle around it

     if (room.anchor)
          room.visual.rect(room.anchor.x - 0.5, room.anchor.y - 0.5, 1, 1, {
               stroke: constants.colors.lightBlue,
               fill: 'transparent',
          })

     controllerVisuals()

     function controllerVisuals() {
          // Stop if there is no controller

          if (!room.controller) return

          // If the controller is mine

          if (room.controller.my) {
               // If the controller level is less than 8, show percentage to next level

               if (room.controller.level < 8)
                    room.visual.text(
                         `%${((room.controller.progress / room.controller.progressTotal) * 100).toFixed(2)}`,
                         room.controller.pos.x,
                         room.controller.pos.y - 1,
                         {
                              backgroundColor: 'rgb(255, 0, 0, 0)',
                              font: 0.5,
                              opacity: 1,
                              color: constants.colors.lightBlue,
                         },
                    )

               // Show the controller's level

               room.visual.text(`${room.controller.level}`, room.controller.pos, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 0.8,
               })
               return
          }

          // If the controller is reserved

          if (room.controller.reservation) {
               // Define the reservationColor based on some conditions

               const color = reservationColor()

               function reservationColor() {
                    if (room.controller.reservation.username === Memory.me) {
                         return constants.colors.lightBlue
                    }

                    if (allyList.has(room.controller.reservation.username)) {
                         return constants.colors.green
                    }

                    return constants.colors.red
               }

               // Show the reservation time

               room.visual.text(`${room.controller.reservation.ticksToEnd}`, room.controller.pos, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 0.8,
                    color,
               })
          }
     }

     spawnVisuals()

     function spawnVisuals() {
          // Get the spawns in the room

          const spawns: StructureSpawn[] = room.get('spawn')

          // Loop through them

          for (const spawn of spawns) {
               // Iterate if the spawn isn't spawning

               if (!spawn.spawning) continue

               // Get the spawning creep, iterating if it's undefined

               const creep = Game.creeps[spawn.spawning.name]
               if (!creep) continue

               // Otherwise display the role of the creep being spawn

               room.visual.text(creep.memory.role, spawn.pos, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 1,
                    color: constants.colors.lightBlue,
               })

               // And display how many ticks left until spawned

               room.visual.text((spawn.spawning.remainingTime - 1).toString(), spawn.pos.x, spawn.pos.y - 1, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 1,
                    color: constants.colors.lightBlue,
               })
          }
     }

     constructionTargetVisuals()

     function constructionTargetVisuals() {
          // If there is not a cSiteTargetID, stop

          if (!room.memory.cSiteTargetID) return

          // Convert the construction target ID into a game object

          const constructionTarget = findObjectWithID(room.memory.cSiteTargetID)

          // If the constructionTarget exists, show visuals for it

          if (constructionTarget) room.visual.text('🚧', constructionTarget.pos)
     }

     planningVisuals()

     function planningVisuals() {

          if (!Memory.baseVisuals) return

          if (!room.memory.planned) return

          for (const stampType in stamps) {
               const stamp = stamps[stampType as StampTypes]

               for (const packedStampAnchor of room.memory.stampAnchors[stampType as StampTypes]) {
                    const stampAnchor = unpackAsPos(packedStampAnchor)

                    for (const structureType in stamp.structures) {
                         if (structureType === 'empty') continue

                         for (const pos of stamp.structures[structureType]) {
                              // Re-assign the pos's x and y to align with the offset

                              const x = pos.x + stampAnchor.x - stamp.offset
                              const y = pos.y + stampAnchor.y - stamp.offset

                              room.visual.structure(x, y, structureType as StructureConstant, {
                                   opacity: 0.3,
                              })
                         }
                    }
               }
          }

          room.visual.connectRoads()
     }

     function towerVisuals() {}
     function labVisuals() {}
     function factoryVisuals() {}
     function powerSpawnVisuals() {}
     function nukerVisuals() {}
     function observerVisuals() {}
     function sourceVisuals() {}
     function mineralVisuals() {}

     // If CPU logging is enabled, log the CPU used by this manager

     if (Memory.cpuLogging)
          customLog(
               'Room Visuals Manager',
               (Game.cpu.getUsed() - managerCPUStart).toFixed(2),
               undefined,
               constants.colors.lightGrey,
          )
}
