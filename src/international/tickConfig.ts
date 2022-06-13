import { allyManager } from 'international/simpleAllies'
import { constants, remoteHarvesterRoles, remoteNeedsIndex, spawnByRoomRemoteRoles, stamps } from './constants'
import { createPackedPosMap, customLog, findCarryPartsRequired } from './generalFunctions'
import { InternationalManager } from './internationalManager'

InternationalManager.prototype.tickConfig = function () {
     // Memory

     // General

     Memory.communes = []

     Memory.stats = {
          lastReset: (Memory.stats?.lastReset || 0) + 1,
          tickLength: Date.now() - (Memory.stats?.tickLength || Date.now()),
          credits: Game.market.credits,
          energy: 0,

          boosts: {},

          // CPU

          cpuLimit: Game.cpu.limit,
          cpuBucket: Game.cpu.bucket,

          // Memory memory

          memoryUsage: Math.floor(RawMemory.get().length / 1000),

          //

          GCLPercent: (Game.gcl.progress / Game.gcl.progressTotal) * 100,
          totalGCL: Math.pow(Game.gcl.level - 1, 2.4) * 1000000 + Game.gcl.progress,
          GCLLevel: Game.gcl.level,

          GPLPercent: (Game.gpl.progress / Game.gpl.progressTotal) * 100,
          totalGPL: Math.pow(Game.gpl.level - 1, 2) * 1000 + Game.gpl.progress,
          GPLLevel: Game.gpl.level,

          //

          energyHarvested: 0,
          mineralsHarvested: 0,

          controlPoints: 0,

          energySpentOnCreeps: 0,
          energySpentOnConstruction: 0,
          energySpentOnRepairing: 0,
          energySpentOnBarricades: 0,
     }

     // global

     global.constructionSitesCount = Object.keys(Game.constructionSites).length
     global.logs = ``

     // Other

     // Configure rooms

     for (const roomName in Game.rooms) {
          const room = Game.rooms[roomName]

          const { controller } = room

          // Single tick properties

          room.myCreeps = {}

          // For each role, construct an array for myCreeps

          for (const role of constants.creepRoles) room.myCreeps[role] = []

          room.myCreepsAmount = 0

          // Assign a position map

          room.creepPositions = createPackedPosMap()

          // Assign a 2d position map

          room.moveRequests = createPackedPosMap(true)

          room.roomObjects = {}

          room.creepsOfSourceAmount = {
               source1: 0,
               source2: 0,
          }

          if (!room.global.tasksWithoutResponders) room.global.tasksWithoutResponders = {}
          if (!room.global.tasksWithResponders) room.global.tasksWithResponders = {}

          // Iterate if there isn't a controller

          if (!controller) continue

          // Iterate if the controller is not mine

          if (!controller.my) continue

          // Set type to commune

          room.memory.type = 'commune'

          //

          if (!room.memory.remotes) room.memory.remotes = []

          // Loop through the name of each of the commune's remotes

          for (let index = room.memory.remotes.length - 1; index >= 0; index -= 1) {
               // Get the name of the remote using the index

               const roomName = room.memory.remotes[index]

               // Get the room's memory using its name

               const roomMemory = Memory.rooms[roomName]

               // If the room isn't a remote, remove it from the remotes array

               if (roomMemory.type !== 'remote' || roomMemory.commune !== room.name) {
                    room.memory.remotes.splice(index, 1)
                    continue
               }

               // Initialize aspects of needs

               roomMemory.needs[remoteNeedsIndex.remoteReserver] = 1

               // Get the room using the roomName

               const remote = Game.rooms[roomName]

               // If there is vision in the room, the controller is reserved, it's reserved be me, and there is sufficient reservation left

               if (
                    remote &&
                    remote.controller.reservation &&
                    remote.controller.reservation.username === Memory.me &&
                    remote.controller.reservation.ticksToEnd >= roomMemory.sourceEfficacies.reduce((a, b) => a + b) * 2
               ) {
                    // Set the reservation need to 0

                    roomMemory.needs[remoteNeedsIndex.remoteReserver] = 0
               }

               roomMemory.needs[remoteNeedsIndex.source1RemoteHarvester] = 3

               roomMemory.needs[remoteNeedsIndex.source2RemoteHarvester] = roomMemory.source2 ? 3 : 0

               roomMemory.needs[remoteNeedsIndex.remoteHauler] = 0

               roomMemory.needs[remoteNeedsIndex.remoteDefender] = 0

               roomMemory.needs[remoteNeedsIndex.remoteCoreAttacker] = 0
          }

          // Add roomName to commune list

          Memory.communes.push(roomName)

          room.creepsFromRoom = {}

          // For each role, construct an array for creepsFromRoom

          for (const role of constants.creepRoles) room.creepsFromRoom[role] = []

          room.creepsFromRoomAmount = 0

          room.creepsFromRoomWithRemote = {}

          // For each remoteName in the room's recorded remotes

          for (const remoteName of room.memory.remotes) {
               // Intialize an array for this room's creepsFromRoomWithRemote

               room.creepsFromRoomWithRemote[remoteName] = {}

               // For each role, construct an array for the role in creepsFromWithRemote

               for (const role of spawnByRoomRemoteRoles) room.creepsFromRoomWithRemote[remoteName][role] = []
          }

          Memory.stats.energy += room.findStoredResourceAmount(RESOURCE_ENERGY)

          // If there is an existing claimRequest and it's invalid, delete it from the room memory

          if (room.memory.claimRequest && !Memory.claimRequests[room.memory.claimRequest])
               delete room.memory.claimRequest

          if (!room.memory.stampAnchors) {
               room.memory.stampAnchors = {}

               for (const type in stamps) room.memory.stampAnchors[type as StampTypes] = []
          }

          room.scoutTargets = new Set()

          if (!room.memory.deposits) room.memory.deposits = {}
     }

     let claimTarget

     for (const roomName in Memory.claimRequests) {

          claimTarget = Memory.claimRequests[roomName]

          if (claimTarget.abadon > 0) {

               claimTarget.abadon -= 1
               continue
          }

          claimTarget.abadon = undefined
     }
}
