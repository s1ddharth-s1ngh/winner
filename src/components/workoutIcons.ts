import { Activity, Bike, Brain, Dumbbell, Flower2, Footprints, Goal, MountainSnow, PersonStanding, Snowflake, Volleyball, WavesLadder, Zap, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Gym: Dumbbell,
  Run: Zap,
  Walk: Footprints,
  Cycling: Bike,
  Swim: WavesLadder,
  Yoga: Flower2,
  Meditation: Brain,
  Ski: Snowflake,
  Football: Goal,
  Padel: Volleyball, // Football/Padel: no longer offered, kept for older logs
  Tennis: Volleyball,
  Dance: PersonStanding,
  Climbing: MountainSnow,
}

export const workoutIcon = (type: string): LucideIcon => ICONS[type] ?? Activity
