import './creepFunctions'

import { constants } from 'international/constants'
import { customLog } from 'international/generalFunctions'
import { controllerUpgraderManager } from './roleManagers/commune/controllerUpgraderManager'
import { mineralHarvesterManager } from './roleManagers/commune/mineralHarvesterManager'
import { antifaManager } from './roleManagers/antifa/antifaManager'
import { maintainerManager } from './roleManagers/commune/maintainerManager'
import { builderManager } from './roleManagers/commune/builderManager'
import { scoutManager } from './roleManagers/international/scoutManager'
import { haulerManager } from './roleManagers/commune/haulerManager'
import { source2RemoteHarvesterManager } from './roleManagers/remote/source2RemoteHarvesterManager'
import { remoteHaulerManager } from './roleManagers/remote/remoteHaulerManager'
import { claimerManager } from './roleManagers/international/claimerManager'
import { meleeDefenderManager } from './roleManagers/commune/meleeDefenderManager'
import { hubHaulerManager } from './roleManagers/commune/hubHaulerManager'
import { fastFillerManager } from './roleManagers/commune/fastFillerManager'
import { source1RemoteHarvesterManager } from './roleManagers/remote/source1RemoteHarvesterManager'
import { remoteReserverManager } from './roleManagers/remote/remoteReserverManager'
import { remoteDefenderManager } from './roleManagers/remote/remoteDefenderManager'
import { vanguardManager } from './roleManagers/international/vanguardManager'
import { sourceHarvesterManager } from './roleManagers/commune/sourceHarvesterManager'
import { depositHarvesterManager } from './roleManagers/remote/depositHarvesterManager'
import { depositHaulerManager } from './roleManagers/remote/depositHaulerManager'
import { remoteCoreAttackerManager } from './roleManagers/remote/remoteCoreAttackerManager'

// Construct managers

const managers: Record<CreepRoles, Function> = {
     source1Harvester: sourceHarvesterManager,
     source2Harvester: sourceHarvesterManager,
     hauler: haulerManager,
     controllerUpgrader: controllerUpgraderManager,
     builder: builderManager,
     maintainer: maintainerManager,
     mineralHarvester: mineralHarvesterManager,
     hubHauler: hubHaulerManager,
     fastFiller: fastFillerManager,
     meleeDefender: meleeDefenderManager,
     source1RemoteHarvester: source1RemoteHarvesterManager,
     source2RemoteHarvester: source2RemoteHarvesterManager,
     remoteHauler: remoteHaulerManager,
     remoteReserver: remoteReserverManager,
     remoteDefender: remoteDefenderManager,
     remoteCoreAttacker: remoteCoreAttackerManager,
     scout: scoutManager,
     claimer: claimerManager,
     vanguard: vanguardManager,
     antifa: antifaManager,
     depositHarvester: depositHarvesterManager,
     depositHauler: depositHaulerManager,
}

export function creepRoleManager(room: Room) {
     // If CPU logging is enabled, get the CPU used at the start

     if (Memory.cpuLogging) var managerCPUStart = Game.cpu.getUsed()

     // Loop through each role in managers

     for (const role of constants.creepRoles) {
          // Get the CPU used at the start

          const roleCPUStart = Game.cpu.getUsed()

          // Get the manager using the role

          const manager = managers[role]

          // Get the amount of creeps with the role

          const creepsOfRoleAmount = room.myCreeps[role].length

          // If there are no creeps for this manager, iterate

          if (!room.myCreeps[role].length) continue

          // Run manager

          manager(room, room.myCreeps[role])

          // Log role stats

          customLog(
               `${role}s`,
               `Creeps: ${creepsOfRoleAmount}, CPU: ${(Game.cpu.getUsed() - roleCPUStart).toFixed(
                    2,
               )}, CPU Per Creep: ${((Game.cpu.getUsed() - roleCPUStart) / creepsOfRoleAmount).toFixed(2)}`,
               undefined,
          )
     }

     // If CPU logging is enabled, log the CPU used by this manager

     if (Memory.cpuLogging)
          customLog(
               'Role Manager',
               `CPU: ${(Game.cpu.getUsed() - managerCPUStart).toFixed(2)}, CPU Per Creep: ${(
                    (Game.cpu.getUsed() - managerCPUStart) /
                    room.myCreepsAmount
               ).toFixed(2)}`,
               undefined,
               constants.colors.lightGrey,
          )
}
