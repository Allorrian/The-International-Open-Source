import { allyList, claimRequestNeedsIndex, constants } from 'international/constants'
import { getRange } from 'international/generalFunctions'
import { VanguardDefender } from 'room/creeps/creepClasses'

export function vanguardDefenderManager(room: Room, creepsOfRole: string[]) {
     // Loop through the names of the creeps of the role

     for (const creepName of creepsOfRole) {
          // Get the creep using its name

          const creep: VanguardDefender = Game.creeps[creepName]

          const claimTarget = Memory.rooms[creep.memory.communeName].claimRequest

          // If the creep has no claim target, stop

          if (!claimTarget) return

          Memory.claimRequests[Memory.rooms[creep.memory.communeName].claimRequest].needs[
               claimRequestNeedsIndex.vanguardDefender
          ] -= creep.strength

          creep.say(claimTarget)

          if (room.name === claimTarget) {
               if (creep.advancedAttackEnemies()) continue

               continue
          }

          // Otherwise if the creep is not in the claimTarget

          // Move to it

          creep.createMoveRequest({
               origin: creep.pos,
               goal: { pos: new RoomPosition(25, 25, claimTarget), range: 25 },
               avoidEnemyRanges: true,
               cacheAmount: 200,
               typeWeights: {
                    enemy: Infinity,
                    ally: Infinity,
                    keeper: Infinity,
                    commune: 1,
                    neutral: 1,
                    highway: 1,
               },
          })
     }
}

VanguardDefender.prototype.advancedAttackEnemies = function () {
     const { room } = this

     // Get enemyAttackers in the room

     const enemyAttackers = room.enemyCreeps.filter(enemyCreep =>
          /* !enemyCreep.isOnExit() && */ enemyCreep.hasPartsOfTypes([ATTACK, RANGED_ATTACK]),
     )

     // If there are none

     if (!enemyAttackers.length) {
          const { enemyCreeps } = room
          if (!enemyCreeps.length) {
               return this.aggressiveHeal()
          }

          // Heal nearby creeps

          if (this.passiveHeal()) return true

          this.say('EC')

          const enemyCreep = this.pos.findClosestByRange(enemyCreeps)
          // Get the range between the creeps

          const range = getRange(this.pos.x - enemyCreep.pos.x, this.pos.y - enemyCreep.pos.y)

          // If the range is more than 1

          if (range > 1) {
               this.rangedAttack(enemyCreep)

               // Have the create a moveRequest to the enemyAttacker and inform true

               this.createMoveRequest({
                    origin: this.pos,
                    goal: { pos: enemyCreep.pos, range: 1 },
               })

               return true
          }

          this.rangedMassAttack()
          if (enemyCreep.owner.username !== 'Invader') this.move(this.pos.getDirectionTo(enemyCreep.pos))

          return true
     }

     // Otherwise, get the closest enemyAttacker

     const enemyAttacker = this.pos.findClosestByRange(enemyAttackers)

     // Get the range between the creeps

     const range = getRange(this.pos.x - enemyAttacker.pos.x, this.pos.y - enemyAttacker.pos.y)

     // If it's more than range 3

     if (range > 3) {
          // Heal nearby creeps

          this.passiveHeal()

          // Make a moveRequest to it and inform true

          this.createMoveRequest({
               origin: this.pos,
               goal: { pos: enemyAttacker.pos, range: 1 },
          })

          return true
     }

     this.say('AEA')

     // Otherwise, have the creep pre-heal itself

     this.heal(this)

     // If the range is 1, rangedMassAttack

     if (range === 1) {
          this.rangedMassAttack()
          this.move(this.pos.getDirectionTo(enemyAttacker.pos))
     }

     // Otherwise, rangedAttack the enemyAttacker
     else this.rangedAttack(enemyAttacker)

     // If the creep is out matched, try to always stay in range 3

     if (this.strength < enemyAttacker.strength) {
          if (range === 3) return true

          if (range >= 3) {
               this.createMoveRequest({
                    origin: this.pos,
                    goal: { pos: enemyAttacker.pos, range: 3 },
               })

               return true
          }

          this.createMoveRequest({
               origin: this.pos,
               goal: { pos: enemyAttacker.pos, range: 25 },
               flee: true,
          })

          return true
     }

     // If the creep has less heal power than the enemyAttacker's attack power

     if (this.strength < enemyAttacker.strength) {
          // If the range is less or equal to 2

          if (range <= 2) {
               // Have the creep flee and inform true

               this.createMoveRequest({
                    origin: this.pos,
                    goal: { pos: enemyAttacker.pos, range: 1 },
                    flee: true,
               })

               return true
          }
     }

     // If the range is more than 1

     if (range > 1) {
          // Have the create a moveRequest to the enemyAttacker and inform true

          this.createMoveRequest({
               origin: this.pos,
               goal: { pos: enemyAttacker.pos, range: 1 },
          })

          return true
     }

     // Otherwise inform true

     return true
}
