import { Layout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Construction, SquareKanban, Waypoints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Home = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 },
    },
  };

  return (
    <Layout>
      <motion.div
        className='container mx-auto max-w-4xl px-4 py-12'
        initial='hidden'
        animate='visible'
        variants={containerVariants}
      >
        <motion.div
          className='mb-6 flex justify-center'
          variants={itemVariants}
        >
          <Badge variant='outline' className='px-3 py-1 text-sm font-medium'>
            <Construction className='mr-2 h-4 w-4' />
            This site is currently under construction.
          </Badge>
        </motion.div>
        <motion.div className='mb-12 text-center' variants={itemVariants}>
          <h1 className='mb-4 text-4xl font-bold'>
            Learn faster, work smarter.
          </h1>
          <p className='mb-8 text-xl text-muted-foreground'>
            <span className='font-semibold'>proust</span> is a next-gen
            browser-native platform for static content analysis.
          </p>
          <div className='flex justify-center space-x-4'>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size='lg' onClick={() => navigate('/workspace')}>
                <Waypoints className='mr-2 h-5 w-5' />
                Get started
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size='lg' variant='outline'>
                <SquareKanban className='mr-2 h-5 w-5' />
                Roadmap
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};
