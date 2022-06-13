import { constants } from 'international/constants'
import { findObjectWithID } from 'international/generalFunctions'
import { Maintainer } from 'room/creeps/creepClasses'
import { RoomTask } from 'room/roomTasks'

Maintainer.prototype.advancedMaintain = function () {
     const creep = this
     const { room } = creep

     creep.say('⏩🔧')

     // If the creep needs resources

     if (creep.needsResources()) {
          creep.say('DR')

          // If creep has a task

          if (global[creep.id]?.respondingTaskID) {
               // Try to filfill task, informing false if it wasn't fulfilled

               const fulfillTaskResult = creep.fulfillTask()
               if (!fulfillTaskResult) return false

               // Otherwise find the task

               const task: RoomTask = room.global.tasksWithResponders[global[creep.id].respondingTaskID]

               // Delete it and inform false

               task.delete()
               return false
          }

          // Otherwise try to find a new task and stop

          creep.findTask(new Set(['pickup', 'withdraw', 'offer']), RESOURCE_ENERGY)

          return false
     }

     // Otherwise if the creep doesn't need resources

     // Get the creep's work part count

     const workPartCount = creep.partsOfType(WORK)

     // Find a repair target based on the creeps work parts. If none are found, inform false

     const repairTarget: Structure | false =
          findObjectWithID(creep.memory.repairTarget) ||
          creep.findRepairTarget() ||
          creep.findRampartRepairTarget(workPartCount)
     if (!repairTarget) return false

     // Add the repair target to memory

     creep.memory.repairTarget = repairTarget.id

     // If roomVisuals are enabled

     if (Memory.roomVisuals)
          room.visual.text(repairTarget.structureType === STRUCTURE_RAMPART ? '🧱' : '🔧', repairTarget.pos)

     // If the repairTarget is out of repair range

     if (creep.pos.getRangeTo(repairTarget.pos) > 3) {
          // Make a move request to it

          creep.createMoveRequest({
               origin: creep.pos,
               goal: { pos: repairTarget.pos, range: 3 },
               avoidEnemyRanges: true,
               weightGamebjects: {
                    1: room.get('road'),
               },
          })

          // Inform false

          return false
     }

     // Otherwise

     // Try to repair the target

     const repairResult = creep.repair(repairTarget)

     // If the repair failed, inform false

     if (repairResult !== OK) return false

     // Find the repair amount by finding the smaller of the creep's work and the progress left for the cSite divided by repair power

     const energySpentOnRepairs = Math.min(workPartCount, (repairTarget.hitsMax - repairTarget.hits) / REPAIR_POWER)

     if (repairTarget.structureType === STRUCTURE_RAMPART) {
          Memory.stats.energySpentOnBarricades += energySpentOnRepairs
          creep.say(`🧱${energySpentOnRepairs * REPAIR_POWER}`)
     } else {
          Memory.stats.energySpentOnRepairing += energySpentOnRepairs
          creep.say(`🔧${energySpentOnRepairs * REPAIR_POWER}`)
     }

     // Implement the results of the repair pre-emptively

     repairTarget.realHits = repairTarget.hits + workPartCount * REPAIR_POWER

     // If the structure is a rampart

     if (repairTarget.structureType === STRUCTURE_RAMPART) {
          // If the repairTarget will be below or equal to expectations next tick, inform true

          if (repairTarget.realHits <= creep.memory.quota + workPartCount * REPAIR_POWER * 25) return true
     }

     // Otherwise if it isn't a rampart and it will be viable to repair next tick, inform true
     else if (repairTarget.hitsMax - repairTarget.realHits >= workPartCount * REPAIR_POWER) return true

     // Otherwise

     // Delete the target from memory

     delete creep.memory.repairTarget

     // Find repair targets that don't include the current target, informing true if none were found

     const newRepairTarget = creep.findRepairTarget(new Set([repairTarget.id]))
     if (!newRepairTarget) return true

     // Make a move request to it

     creep.createMoveRequest({
          origin: creep.pos,
          goal: { pos: newRepairTarget.pos, range: 3 },
          avoidEnemyRanges: true,
          weightGamebjects: {
               1: room.get('road'),
          },
     })

     // Inform false

     return true
}

Maintainer.prototype.maintainNearby = function () {
     const { room } = this

     // If the creep has no energy, inform false

     if (this.store.getUsedCapacity(RESOURCE_ENERGY) === 0) return false

     // Otherwise, look at the creep's pos for structures

     const structuresAsPos = this.pos.lookFor(LOOK_STRUCTURES)

     // Get the creep's work parts

     const workPartCount = this.partsOfType(WORK)

     let structure

     // Loop through structuresAtPos

     for (structure of structuresAsPos) {
          // If the structure is not a road, iterate

          if (structure.structureType !== STRUCTURE_ROAD && structure.structureType !== STRUCTURE_CONTAINER) continue

          // If the structure is sufficiently repaired, inform false

          if (structure.hitsMax - structure.hits < workPartCount * REPAIR_POWER) break

          // Otherwise, try to repair the structure, informing false if failure

          if (this.repair(structure) !== OK) return false

          // Otherwise

          // Find the repair amount by finding the smaller of the creep's work and the progress left for the cSite divided by repair power

          const energySpentOnRepairs = Math.min(workPartCount, (structure.hitsMax - structure.hits) / REPAIR_POWER)

          // Show the creep tried to repair

          this.say(`👣🔧${energySpentOnRepairs * REPAIR_POWER}`)
          return true
     }

     const adjacentStructures = room.lookForAtArea(
          LOOK_STRUCTURES,
          Math.max(Math.min(this.pos.y - 3, constants.roomDimensions - 1), 1),
          Math.max(Math.min(this.pos.x - 3, constants.roomDimensions - 1), 1),
          Math.max(Math.min(this.pos.y + 3, constants.roomDimensions - 1), 1),
          Math.max(Math.min(this.pos.x + 3, constants.roomDimensions - 1), 1),
          true,
     )

     for (const adjacentPosData of adjacentStructures) {
          structure = adjacentPosData.structure

          // If the structure is not a road, iterate

          if (structure.structureType !== STRUCTURE_ROAD && structure.structureType !== STRUCTURE_CONTAINER) continue

          // If the structure is sufficiently repaired, inform false

          if (structure.hitsMax - structure.hits < workPartCount * REPAIR_POWER) continue

          // Otherwise, try to repair the structure, informing false if failure

          if (this.repair(structure) !== OK) return false

          // Otherwise

          // Find the repair amount by finding the smaller of the creep's work and the progress left for the cSite divided by repair power

          const energySpentOnRepairs = Math.min(workPartCount, (structure.hitsMax - structure.hits) / REPAIR_POWER)

          // Show the creep tried to repair

          this.say(`🗺️🔧${energySpentOnRepairs * REPAIR_POWER}`)
          return true
     }

     // If no road to repair was found, inform false

     return false
}
