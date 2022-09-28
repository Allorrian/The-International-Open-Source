import { allowedSquadCombinations, antifaRoles, myColors } from 'international/constants'
import { customLog, findClosestObject, getRange, isExit, pack } from 'international/generalFunctions'
import { internationalManager } from 'international/internationalManager'
import { Duo } from './duo'
import { Quad } from './quad'

export class Antifa extends Creep {
    constructor(creepID: Id<Creep>) {
        super(creepID)
    }

    preTickManager() {
        if (!internationalManager.creepsByCombatRequest[this.memory.CRN]) {
            internationalManager.creepsByCombatRequest[this.memory.CRN] = {}
            for (const role of antifaRoles) internationalManager.creepsByCombatRequest[this.memory.CRN][role] = []
        }

        internationalManager.creepsByCombatRequest[this.memory.CRN][this.role].push(this.name)

        if (!this.memory.SS) return

        const squadMembers: Antifa[] = [this]

        if (this.memory.SMNs) {
            for (let i = 0; i < this.memory.SMNs.length; i++) {
                const creep = Game.creeps[this.memory.SMNs[i]]

                if (!creep) {
                    this.memory.SMNs.splice(i, 1)
                    break
                }

                squadMembers.push(creep)
            }

            if (this.memory.SMNs.length === this.memory.SS) {
                if (this.memory.SS === 2) {
                    this.squad = new Duo(squadMembers)
                    return
                }

                this.squad = new Quad(squadMembers)
                return
            }
        }

        // The creep didn't have enough members to form a squad, so make a request

        this.memory.SMNs = [this.name]
        this.room.squadRequests.add(this.name)
    }

    runSquad?() {
        // The creep should be single

        if (!this.memory.SS) return false

        // The creep is in a squad but no the leader

        if (!this.squad && this.memory.SMNs.length === this.memory.SS) return true

        if (!this.createSquad()) return true

        this.squad.run()
        return true
    }

    /**
     * Tries to find a squad, creating one if none could be found
     */
    createSquad?() {
        for (const requestingCreepName of this.room.squadRequests) {
            if (requestingCreepName === this.name) continue

            const requestingCreep = Game.creeps[requestingCreepName]

            if (this.memory.ST !== requestingCreep.memory.ST) continue

            // If the creep is allowed to join the other creep

            if (!allowedSquadCombinations[this.memory.SS][this.role].has(requestingCreep.role)) continue

            this.memory.SMNs.push(requestingCreepName)

            if (this.memory.SMNs.length === this.memory.SS) break
        }

        if (this.memory.SMNs.length !== this.memory.SS) return false

        const squadMembers: Antifa[] = []

        for (const squadCreepName of this.memory.SMNs) {
            this.room.squadRequests.delete(squadCreepName)

            const squadCreep = Game.creeps[squadCreepName]

            squadCreep.memory.SMNs = this.memory.SMNs
            squadMembers.push(squadCreep)
        }

        if (this.memory.SS === 2) {
            this.squad = new Duo(squadMembers)
            return true
        }

        this.squad = new Quad(squadMembers)
        return true
    }

    runSingle?() {
        const { room } = this

        // In attackTarget

        if (this.memory.CRN === room.name) {
            if (this.runCombat()) return

            this.stompEnemyCSites()
            return
        }

        this.passiveRangedAttack()
        this.passiveHeal()

        // In the commune

        if (this.commune?.name === this.name) {
            // Go to the attackTarget

            this.createMoveRequest({
                origin: this.pos,
                goals: [
                    {
                        pos: new RoomPosition(25, 25, this.memory.CRN),
                        range: 25,
                    },
                ],
                typeWeights: {
                    enemy: Infinity,
                    ally: Infinity,
                    keeper: Infinity,
                },
            })
            return
        }

        // In a non-attackTarget or commune room

        // Go to the attackTarget

        this.createMoveRequest({
            origin: this.pos,
            goals: [
                {
                    pos: new RoomPosition(25, 25, this.memory.CRN),
                    range: 25,
                },
            ],
            typeWeights: {
                enemy: Infinity,
                ally: Infinity,
                keeper: Infinity,
            },
        })
    }

    runCombat?() {
        if (this.role === 'antifaRangedAttacker') return this.advancedRangedAttack()
        if (this.role === 'antifaAttacker') return this.advancedAttack()
        return this.advancedDismantle()
    }

    advancedRangedAttack?() {
        const { room } = this

        let enemyAttackers = room.enemyAttackers.filter(function (creep) {
            return !creep.isOnExit()
        })

        if (!enemyAttackers.length) enemyAttackers = room.enemyAttackers

        // If there are none

        if (!enemyAttackers.length) {
            let enemyCreeps = room.enemyCreeps.filter(function (creep) {
                return !creep.isOnExit()
            })

            if (!enemyCreeps.length) enemyCreeps = room.enemyCreeps

            if (!enemyCreeps.length) {
                if (this.aggressiveHeal()) return true
                return this.rangedAttackStructures()
            }

            // Heal nearby creeps

            if (this.passiveHeal()) return true

            this.say('EC')

            const enemyCreep = findClosestObject(this.pos, enemyCreeps)
            if (Memory.roomVisuals)
                this.room.visual.line(this.pos, enemyCreep.pos, { color: myColors.green, opacity: 0.3 })

            // Get the range between the creeps

            const range = getRange(this.pos.x, enemyCreep.pos.x, this.pos.y, enemyCreep.pos.y)

            // If the range is more than 1

            if (range > 1) {
                this.rangedAttack(enemyCreep)

                // Have the create a moveRequest to the enemyAttacker and inform true

                this.createMoveRequest({
                    origin: this.pos,
                    goals: [{ pos: enemyCreep.pos, range: 1 }],
                })

                return true
            }

            this.rangedMassAttack()
            if (enemyCreep.canMove) this.assignMoveRequest(enemyCreep.pos)
            return true
        }

        // Otherwise, get the closest enemyAttacker

        const enemyAttacker = findClosestObject(this.pos, enemyAttackers)
        if (Memory.roomVisuals)
            this.room.visual.line(this.pos, enemyAttacker.pos, { color: myColors.green, opacity: 0.3 })

        // Get the range between the creeps

        const range = getRange(this.pos.x, enemyAttacker.pos.x, this.pos.y, enemyAttacker.pos.y)

        // If it's more than range 3

        if (range > 3) {
            // Heal nearby creeps

            this.passiveHeal()

            // Make a moveRequest to it and inform true

            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: enemyAttacker.pos, range: 1 }],
            })

            return true
        }

        this.say('AEA')

        // Have the creep pre-heal itself

        this.heal(this)

        if (range === 1) this.rangedMassAttack()
        else this.rangedAttack(enemyAttacker)

        // If the creep has less heal power than the enemyAttacker's attack power

        if (this.healStrength < enemyAttacker.attackStrength) {
            if (range === 3) return true

            // If too close

            if (range <= 2) {
                // Have the creep flee

                this.createMoveRequest({
                    origin: this.pos,
                    goals: [{ pos: enemyAttacker.pos, range: 1 }],
                    flee: true,
                })
            }

            return true
        }

        if (range > 1) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: enemyAttacker.pos, range: 1 }],
            })

            return true
        }

        if (enemyAttacker.canMove) this.assignMoveRequest(enemyAttacker.pos)
        return true
    }

    rangedAttackStructures?() {
        this.say('RAS')

        const structures = this.room.dismantleableStructures

        if (!structures.length) return false

        let structure = findClosestObject(this.pos, structures)
        if (Memory.roomVisuals) this.room.visual.line(this.pos, structure.pos, { color: myColors.green, opacity: 0.3 })

        if (getRange(this.pos.x, structure.pos.x, this.pos.y, structure.pos.y) > 3) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: structure.pos, range: 3 }],
            })

            return false
        }

        if (this.rangedAttack(structure) !== OK) return false

        // See if the structure is destroyed next tick

        structure.realHits = structure.hits - this.parts.ranged_attack * RANGED_ATTACK_POWER
        if (structure.realHits > 0) return true

        // Try to find a new structure to preemptively move to

        structures.splice(structures.indexOf(structure), 1)
        if (!structures.length) return true

        structure = findClosestObject(this.pos, structures)

        if (getRange(this.pos.x, structure.pos.y, this.pos.y, structure.pos.y) > 3) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: structure.pos, range: 3 }],
            })
        }

        return true
    }

    advancedAttack?() {
        const { room } = this

        let enemyAttackers = room.enemyAttackers.filter(function (creep) {
            return !creep.isOnExit()
        })

        if (!enemyAttackers.length) enemyAttackers = room.enemyAttackers

        // If there are none

        if (!enemyAttackers.length) {
            let enemyCreeps = room.enemyCreeps.filter(function (creep) {
                return !creep.isOnExit()
            })

            if (!enemyCreeps) enemyCreeps = room.enemyCreeps

            if (!enemyCreeps.length) return this.attackStructures()

            this.say('EC')

            const enemyCreep = findClosestObject(this.pos, enemyCreeps)
            if (Memory.roomVisuals)
                this.room.visual.line(this.pos, enemyCreep.pos, { color: myColors.green, opacity: 0.3 })

            // If the range is more than 1

            if (getRange(this.pos.x, enemyCreep.pos.x, this.pos.y, enemyCreep.pos.y) > 1) {
                // Have the create a moveRequest to the enemyAttacker and inform true

                this.createMoveRequest({
                    origin: this.pos,
                    goals: [{ pos: enemyCreep.pos, range: 1 }],
                })

                return true
            }

            if (enemyCreep.canMove) this.assignMoveRequest(enemyCreep.pos)
            return true
        }

        const enemyAttacker = findClosestObject(this.pos, enemyAttackers)
        if (Memory.roomVisuals)
            this.room.visual.line(this.pos, enemyAttacker.pos, { color: myColors.green, opacity: 0.3 })

        // If the range is more than 1

        if (getRange(this.pos.x, enemyAttacker.pos.x, this.pos.y, enemyAttacker.pos.y) > 1) {
            // Have the create a moveRequest to the enemyAttacker and inform true

            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: enemyAttacker.pos, range: 1 }],
            })

            return true
        }

        // Otherwise attack

        this.attack(enemyAttacker)

        if (enemyAttacker.canMove) this.assignMoveRequest(enemyAttacker.pos)
        return true
    }

    attackStructures?() {
        this.say('AS')

        const structures = this.room.dismantleableStructures

        if (!structures.length) return false

        let structure = findClosestObject(this.pos, structures)
        if (Memory.roomVisuals) this.room.visual.line(this.pos, structure.pos, { color: myColors.green, opacity: 0.3 })

        if (getRange(this.pos.x, structure.pos.x, this.pos.y, structure.pos.y) > 1) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: structure.pos, range: 1 }],
            })

            return false
        }

        if (this.attack(structure) !== OK) return false

        // See if the structure is destroyed next tick

        structure.realHits = structure.hits - this.parts.attack * ATTACK_POWER
        if (structure.realHits > 0) return true

        // Try to find a new structure to preemptively move to

        structures.splice(structures.indexOf(structure), 1)
        if (!structures.length) return true

        structure = findClosestObject(this.pos, structures)

        if (getRange(this.pos.x, structure.pos.y, this.pos.y, structure.pos.y) > 1) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: structure.pos, range: 1 }],
            })
        }

        return true
    }

    advancedDismantle?() {
        // Avoid targets we can't dismantle

        const structures = this.room.dismantleableStructures

        if (!structures.length) return false

        let structure = findClosestObject(this.pos, structures)
        if (Memory.roomVisuals) this.room.visual.line(this.pos, structure.pos, { color: myColors.green, opacity: 0.3 })

        if (getRange(this.pos.x, structure.pos.x, this.pos.y, structure.pos.y) > 1) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: structure.pos, range: 1 }],
            })

            return true
        }

        if (this.dismantle(structure) !== OK) return false

        // See if the structure is destroyed next tick

        structure.realHits = structure.hits - this.parts.work * DISMANTLE_POWER
        if (structure.realHits > 0) return true

        // Try to find a new structure to preemptively move to

        structures.splice(structures.indexOf(structure), 1)
        if (!structures.length) return true

        structure = findClosestObject(this.pos, structures)

        if (getRange(this.pos.x, structure.pos.y, this.pos.y, structure.pos.y) > 1) {
            this.createMoveRequest({
                origin: this.pos,
                goals: [{ pos: structure.pos, range: 1 }],
            })
        }

        return true
    }

    stompEnemyCSites?() {
        if (this.room.controller && this.room.controller.safeMode) return false

        // Filter only enemy construction sites worth stomping

        const enemyCSites = this.room.enemyCSites.filter(
            cSite => cSite.progress > 0 && !isExit(cSite.pos.x, cSite.pos.y),
        )

        if (!enemyCSites.length) return false

        const enemyCSite = findClosestObject(this.pos, enemyCSites)

        this.createMoveRequest({
            origin: this.pos,
            goals: [{ pos: enemyCSite.pos, range: 0 }],
        })

        return true
    }

    static antifaManager(room: Room, creepsOfRole: string[]) {
        for (const creepName of creepsOfRole) {
            const creep: Antifa = Game.creeps[creepName]

            if (!creep.runSquad()) creep.runSingle()
        }
    }
}