import { Activity, Bike, Dumbbell, Flower2, Footprints, Goal, MountainSnow, PersonStanding, Volleyball, WavesLadder, Zap, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Gym: Dumbbell,
  Run: Zap,
  Walk: Footprints,
  Cycling: Bike,
  Swim: WavesLadder,
  Yoga: Flower2,
  Football: Goal,
  Padel: Volleyball,
  Tennis: Volleyball,
  Dance: PersonStanding,
  Climbing: MountainSnow,
}

export const workoutIcon = (type: string): LucideIcon => ICONS[type] ?? Activity
