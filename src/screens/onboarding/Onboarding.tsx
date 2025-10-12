import React, { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import StepDetails from './StepDetails';
import StepAims from './StepAims';
import StepEquipment from './StepEquipment';

type Props = { onDone: () => void; userId: string };

export default function Onboarding({ onDone, userId }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [preferredName, setPreferredName] = useState('');
  const [age, setAge] = useState(''); 
  const [menstruating, setMenstruating] = useState<boolean | null>(null);
  const [activityLevel, setActivityLevel] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('');
  const [disability, setDisability] = useState('');
  const [childrenStatus, setChildrenStatus] = useState<'none' | 'baby' | 'toddler' | 'child' | 'teenager' | 'not_dependent' | ''>('');

  const [skills, setSkills] = useState(''); 

  const [clothes, setClothes] = useState('');
  const [home, setHome] = useState('');
  const [outdoors, setOutdoors] = useState('');
  const [gym, setGym] = useState('');
  const [saving, setSaving] = useState(false);

  function parseList(s: string) {
    return s.split(',').map(x => x.trim()).filter(Boolean);
  }

  async function handleFinish() {
    try {
      setSaving(true);

      const payload = {
        id: userId,
        preferred_name: preferredName || null,
        age: age ? Number(age) : null,
        menstruating,
        activity_level: activityLevel || null,
        disability: disability || null,
        children_status: childrenStatus || null,
        skills: parseList(skills),
        equipment: {
          clothes: parseList(clothes),
          home: parseList(home),
          outdoors: parseList(outdoors),
          gym: parseList(gym),
        },
        onboarded: true,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      onDone(); 
    } catch (e: any) {
      Alert.alert('Could not save profile', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (step === 0) {
    return (
      <StepDetails
        preferredName={preferredName} setPreferredName={setPreferredName}
        age={age} setAge={setAge}
        menstruating={menstruating} setMenstruating={v => setMenstruating(v)}
        activityLevel={activityLevel} setActivityLevel={v => setActivityLevel(v)}
        disability={disability} setDisability={setDisability}
        childrenStatus={childrenStatus} setChildrenStatus={setChildrenStatus}
        onNext={() => setStep(1)}
      />
    );
  }

  if (step === 1) {
    return (
      <StepAims
        skills={skills}
        setSkills={setSkills}
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
      />
    );
  }

  return (
    <StepEquipment
      clothes={clothes} setClothes={setClothes}
      home={home} setHome={setHome}
      outdoors={outdoors} setOutdoors={setOutdoors}
      gym={gym} setGym={setGym}
      onBack={() => setStep(1)}
      onFinish={handleFinish}
      saving={saving}
    />
  );
}
