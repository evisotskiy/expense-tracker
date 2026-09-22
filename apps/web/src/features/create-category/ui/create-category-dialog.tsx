'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';

import { useCreateCategory } from '../model/use-create-category';
import { CategoryForm } from './category-form';

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCategoryDialog({ open, onOpenChange }: CreateCategoryDialogProps) {
  const createCategoryMutation = useCreateCategory();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая категория</DialogTitle>
        </DialogHeader>
        <CategoryForm
          onSubmit={async (values) => {
            await createCategoryMutation.mutateAsync(values);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
